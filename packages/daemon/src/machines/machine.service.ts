// ── MachineService ──────────────────────────────────────────
// Manages per-user machine pairing and SSH tunnel connections.

import type { Database } from "bun:sqlite";
import { TmuxService } from "../sessions/tmux.service.js";
import type { RemoteSSHConfig } from "../sessions/tmux.service.js";

// ── DB row types ──────────────────────────────────────────

interface MachineRow {
  id: string;
  user_id: string;
  ssh_port: number;
  ssh_user: string;
  ssh_host: string;
  status: string;
  label: string | null;
  paired_at: number | null;
  last_seen: number | null;
}

interface PairingTokenRow {
  token: string;
  user_id: string;
  ssh_port: number;
  expires_at: number;
  used: number;
}

// ── Config ────────────────────────────────────────────────

const PORT_RANGE_START = parseInt(process.env.TUNNEL_PORT_RANGE_START ?? "10000", 10);
const PORT_RANGE_END = parseInt(process.env.TUNNEL_PORT_RANGE_END ?? "10999", 10);
const SSH_IDENTITY_FILE = process.env.REMOTE_SSH_KEY ?? "/home/codemobile/.ssh/id_ed25519_codemobile";

// ── Public types ──────────────────────────────────────────

export interface MachineInfo {
  id: string;
  userId: string;
  sshPort: number;
  sshUser: string;
  status: "pending" | "online" | "offline";
  label: string | null;
  pairedAt: Date | null;
  lastSeen: Date | null;
}

export interface PairingInfo {
  userId: string;
  sshPort: number;
  pairingToken: string;
  pairingCommand: string;
}

// ── MachineService ────────────────────────────────────────

export class MachineService {
  private tmuxInstances = new Map<string, TmuxService>();
  private readonly db: Database;
  private readonly serverHost: string;

  constructor(db: Database, serverHost?: string) {
    this.db = db;
    this.serverHost = serverHost ?? process.env.SERVER_HOST ?? "localhost";
  }

  // ── Per-user TmuxService ────────────────────────────────

  /** Get or create a TmuxService for a user. Returns null if user has no paired machine. */
  getTmuxForUser(userId: string): TmuxService | null {
    // Check cache
    const cached = this.tmuxInstances.get(userId);
    if (cached) return cached;

    // Look up machine
    const machine = this.getMachineByUser(userId);
    if (!machine || machine.status === "pending") return null;

    // Create TmuxService with user's SSH config
    const sshConfig: RemoteSSHConfig = {
      host: machine.ssh_host,
      port: machine.ssh_port,
      user: machine.ssh_user,
      identityFile: SSH_IDENTITY_FILE,
    };

    const tmux = new TmuxService(sshConfig);
    this.tmuxInstances.set(userId, tmux);
    return tmux;
  }

  /** Get SSH config for a user (used by file upload, etc.) */
  getSSHConfigForUser(userId: string): RemoteSSHConfig | null {
    const machine = this.getMachineByUser(userId);
    if (!machine || machine.status === "pending") return null;

    return {
      host: machine.ssh_host,
      port: machine.ssh_port,
      user: machine.ssh_user,
      identityFile: SSH_IDENTITY_FILE,
    };
  }

  // ── Port allocation ─────────────────────────────────────

  allocatePort(userId: string): number {
    // Check if user already has a port
    const existing = this.db
      .query<{ port: number }, [string]>("SELECT port FROM port_allocations WHERE user_id = ?")
      .get(userId);
    if (existing) return existing.port;

    // Find next available port
    const usedPorts = new Set(
      this.db
        .query<{ port: number }, []>("SELECT port FROM port_allocations")
        .all()
        .map((r) => r.port),
    );

    for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
      if (!usedPorts.has(port)) {
        this.db.run(
          "INSERT INTO port_allocations (port, user_id) VALUES (?, ?)",
          [port, userId],
        );
        return port;
      }
    }

    throw new Error("No available ports in range");
  }

  // ── Pairing flow ────────────────────────────────────────

  /** Create a pairing token for a user. Allocates a port if needed. */
  createPairingToken(userId: string): PairingInfo {
    const sshPort = this.allocatePort(userId);

    // Generate a short token
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const token = Buffer.from(bytes).toString("hex");
    const expiresAt = Math.floor(Date.now() / 1000) + 15 * 60; // 15 minutes

    // Ensure machine row exists
    const existing = this.getMachineByUser(userId);
    if (!existing) {
      this.db.run(
        "INSERT INTO user_machines (id, user_id, ssh_port, status) VALUES (?, ?, ?, 'pending')",
        [crypto.randomUUID(), userId, sshPort],
      );
    }

    // Store pairing token
    this.db.run(
      "INSERT OR REPLACE INTO pairing_tokens (token, user_id, ssh_port, expires_at) VALUES (?, ?, ?, ?)",
      [token, userId, sshPort, expiresAt],
    );

    const pairingCommand = `curl -sSL https://${this.serverHost}/pair.sh | bash -s -- --server ${this.serverHost} --port ${sshPort} --token ${token}`;

    return { userId, sshPort, pairingToken: token, pairingCommand };
  }

  /** Validate and consume a pairing token. Returns the machine info or null. */
  redeemPairingToken(token: string, sshUser: string): MachineRow | null {
    const row = this.db
      .query<PairingTokenRow, [string]>("SELECT * FROM pairing_tokens WHERE token = ?")
      .get(token);

    if (!row) return null;
    if (row.used) return null;
    if (row.expires_at < Math.floor(Date.now() / 1000)) return null;

    // Mark token as used
    this.db.run("UPDATE pairing_tokens SET used = 1 WHERE token = ?", [token]);

    // Update machine status
    this.db.run(
      `UPDATE user_machines SET status = 'online', ssh_user = ?, paired_at = unixepoch(), last_seen = unixepoch()
       WHERE user_id = ?`,
      [sshUser, row.user_id],
    );

    // Clear cached TmuxService (will be recreated with correct user)
    this.tmuxInstances.delete(row.user_id);

    return this.db
      .query<MachineRow, [string]>("SELECT * FROM user_machines WHERE user_id = ?")
      .get(row.user_id) ?? null;
  }

  // ── Health checks ───────────────────────────────────────

  /** Check if a user's machine is reachable via SSH tunnel. */
  async checkMachineHealth(userId: string): Promise<"online" | "offline"> {
    const machine = this.getMachineByUser(userId);
    if (!machine) return "offline";

    try {
      const proc = Bun.spawn([
        "ssh",
        "-p", String(machine.ssh_port),
        "-i", SSH_IDENTITY_FILE,
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=3",
        `${machine.ssh_user}@${machine.ssh_host}`,
        "echo ok",
      ], { stdout: "pipe", stderr: "pipe" });

      const exitCode = await proc.exited;
      const status = exitCode === 0 ? "online" : "offline";

      this.db.run(
        "UPDATE user_machines SET status = ?, last_seen = unixepoch() WHERE user_id = ?",
        [status, userId],
      );

      // Invalidate cached TmuxService if offline
      if (status === "offline") {
        this.tmuxInstances.delete(userId);
      }

      return status;
    } catch {
      this.db.run("UPDATE user_machines SET status = 'offline' WHERE user_id = ?", [userId]);
      this.tmuxInstances.delete(userId);
      return "offline";
    }
  }

  /** Run health checks on all paired machines. */
  async checkAllMachines(): Promise<void> {
    const machines = this.db
      .query<MachineRow, []>("SELECT * FROM user_machines WHERE status != 'pending'")
      .all();

    for (const machine of machines) {
      await this.checkMachineHealth(machine.user_id);
    }
  }

  // ── Queries ─────────────────────────────────────────────

  getMachineByUser(userId: string): MachineRow | null {
    return this.db
      .query<MachineRow, [string]>("SELECT * FROM user_machines WHERE user_id = ?")
      .get(userId) ?? null;
  }

  listMachines(): MachineInfo[] {
    return this.db
      .query<MachineRow, []>("SELECT * FROM user_machines ORDER BY paired_at DESC")
      .all()
      .map(this.rowToInfo);
  }

  deleteMachine(userId: string): void {
    this.db.run("DELETE FROM user_machines WHERE user_id = ?", [userId]);
    this.db.run("DELETE FROM port_allocations WHERE user_id = ?", [userId]);
    this.tmuxInstances.delete(userId);
  }

  // ── Internals ───────────────────────────────────────────

  private rowToInfo(row: MachineRow): MachineInfo {
    return {
      id: row.id,
      userId: row.user_id,
      sshPort: row.ssh_port,
      sshUser: row.ssh_user,
      status: row.status as MachineInfo["status"],
      label: row.label,
      pairedAt: row.paired_at ? new Date(row.paired_at * 1000) : null,
      lastSeen: row.last_seen ? new Date(row.last_seen * 1000) : null,
    };
  }
}

// ── SessionManager ──────────────────────────────────────────
// High-level orchestration: wires tmux, streaming, and DB.

import { mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import type { Database } from "bun:sqlite";
import type { SessionId, SessionStatus, SessionCreateOptions, Session } from "@code-mobile/core";
import { PROVIDERS } from "@code-mobile/core";
import type { TmuxService } from "./tmux.service.js";
import { TmuxError } from "./tmux.service.js";
import { SessionStreamer } from "./session.streamer.js";
import type { ProviderRegistry } from "@code-mobile/providers";
import type { ApiKeyService } from "../apikeys/apikey.service.js";
import type { AnalyticsService } from "../analytics/analytics.service.js";
import type { MachineService } from "../machines/machine.service.js";

// ── DB row shape ────────────────────────────────────────────

interface SessionRow {
  id: string;
  name: string;
  provider_id: string;
  model: string;
  status: string;
  tmux_name: string;
  work_dir: string;
  pid: number | null;
  conversation_id: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

// ── SessionManager ──────────────────────────────────────────

export class SessionManager {
  private streamers = new Map<string, SessionStreamer>();
  private providerRegistry?: ProviderRegistry;
  private apiKeyService?: ApiKeyService;
  private analyticsService?: AnalyticsService;

  constructor(
    private readonly db: Database,
    private readonly tmux: TmuxService,
    private readonly dataDir: string,
    private readonly machineService?: MachineService,
  ) {}

  /** Wire in optional services for provider adapter resolution and analytics. */
  setServices(registry: ProviderRegistry, apiKeys: ApiKeyService, analytics: AnalyticsService): void {
    this.providerRegistry = registry;
    this.apiKeyService = apiKeys;
    this.analyticsService = analytics;
  }

  // ── Startup reconciliation ────────────────────────────────

  /** Check DB for 'running'/'starting' sessions and verify tmux reality. */
  async reconcile(): Promise<void> {
    const rows = this.db
      .query<SessionRow, []>(
        "SELECT * FROM sessions WHERE status IN ('starting', 'running')",
      )
      .all();

    for (const row of rows) {
      const alive = await this.tmux.hasSession(row.tmux_name);
      if (!alive) {
        this.db.run(
          "UPDATE sessions SET status = 'stopped', updated_at = unixepoch() WHERE id = ?",
          [row.id],
        );
      } else {
        // Re-attach streamer for live sessions
        this.ensureStreamer(row.id, row.tmux_name);
      }
    }
  }

  // ── Create ────────────────────────────────────────────────

  /** Resolve the TmuxService for a given user. Falls back to the legacy global tmux. */
  private getTmux(userId?: string): TmuxService {
    if (userId && this.machineService) {
      const userTmux = this.machineService.getTmuxForUser(userId);
      if (userTmux) return userTmux;
    }
    return this.tmux;
  }

  async createSession(options: SessionCreateOptions, userId?: string): Promise<Session> {
    const id = crypto.randomUUID() as SessionId;
    const shortId = id.slice(0, 8);
    const tmuxName = `cm-${shortId}`;
    const name = options.name ?? `${options.providerId}-${shortId}`;

    // Resolve provider spawn command
    const provider = PROVIDERS[options.providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${options.providerId}`);
    }
    const model = options.model ?? provider.defaultModel;

    // Work directory — validate to prevent path traversal
    const workDir = options.workDir ? resolve(options.workDir) : process.cwd();
    if (workDir.includes("\0")) {
      throw new Error("Invalid work directory path");
    }

    // Use provider adapter if available, otherwise fall back to simple resolution
    let command: string;
    let args: string[];
    let adapterEnv: Record<string, string> = {};

    if (this.providerRegistry?.has(options.providerId)) {
      const adapter = this.providerRegistry.get(options.providerId);
      const apiKey = this.apiKeyService
        ? await this.apiKeyService.getDecrypted(options.providerId)
        : null;
      const spawnConfig = adapter.getSpawnCommand(
        { model, workDir, dataDir: this.dataDir, sessionId: id, conversationId: options.conversationId ?? undefined },
        apiKey ?? undefined,
      );
      command = spawnConfig.command;
      args = spawnConfig.args;
      adapterEnv = spawnConfig.env;
    } else {
      const resolved = this.resolveSpawnCommand(options.providerId, model);
      command = resolved.command;
      args = resolved.args;
    }

    // Ensure session output directory
    const sessionDir = join(this.dataDir, "sessions", id);
    mkdirSync(sessionDir, { recursive: true });
    const outputPath = join(sessionDir, "output.log");

    // Build env vars (adapter env + filtered user overrides)
    // Block dangerous env vars that could hijack execution
    const BLOCKED_ENV_VARS = new Set([
      "PATH", "HOME", "SHELL", "USER", "LD_PRELOAD", "LD_LIBRARY_PATH",
      "NODE_OPTIONS", "BUN_INSTALL", "PYTHONPATH",
    ]);
    const filteredUserEnv: Record<string, string> = {};
    if (options.envVars) {
      for (const [k, v] of Object.entries(options.envVars)) {
        if (!BLOCKED_ENV_VARS.has(k.toUpperCase())) {
          filteredUserEnv[k] = v;
        }
      }
    }

    const env: Record<string, string> = {
      ...adapterEnv,
      ...filteredUserEnv,
      TERM: "xterm-256color",
    };

    // Create the tmux session (per-user or legacy)
    const tmux = this.getTmux(userId);
    await tmux.createSession(tmuxName, command, args, env);

    // Pipe terminal output to file
    await tmux.pipePaneToFile(tmuxName, outputPath);

    // Start streamer
    const streamer = new SessionStreamer(id, outputPath);
    streamer.start();
    this.streamers.set(id, streamer);

    // Insert into DB
    this.db.run(
      `INSERT INTO sessions (id, name, provider_id, model, status, tmux_name, work_dir, conversation_id, user_id)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
      [id, name, options.providerId, model, tmuxName, workDir, options.conversationId ?? null, userId ?? null],
    );

    const row = this.db
      .query<SessionRow, [string]>("SELECT * FROM sessions WHERE id = ?")
      .get(id);
    if (!row) throw new Error("Failed to read newly created session");

    // Record analytics event
    this.analyticsService?.recordEvent(id, "session_start", { model, workDir }, options.providerId);

    // Start analytics file watching if adapter supports it
    const outputPath2 = join(this.dataDir, "sessions", id, "output.log");
    this.analyticsService?.startWatching(id, options.providerId, outputPath2);

    return this.rowToSession(row);
  }

  // ── Stop ──────────────────────────────────────────────────

  async stopSession(id: string): Promise<void> {
    const row = this.getRow(id);
    if (!row) throw new Error("Session not found");
    if (row.status === "stopped") return;

    // Graceful shutdown: Ctrl-C → wait → "exit" → wait → kill
    const tmux = this.getTmux(row.user_id ?? undefined);
    try {
      await tmux.sendKeys(row.tmux_name, "C-c");
      await sleep(3000);

      if (await tmux.hasSession(row.tmux_name)) {
        await tmux.sendText(row.tmux_name, "exit");
        await tmux.sendKeys(row.tmux_name, "Enter");
        await sleep(2000);
      }

      if (await tmux.hasSession(row.tmux_name)) {
        await tmux.killSession(row.tmux_name);
      }
    } catch (err) {
      // Session may have already exited or tmux server stopped
      if (err instanceof TmuxError) {
        if (err.code !== "SESSION_NOT_FOUND" && err.code !== "SERVER_NOT_RUNNING") {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Stop streamer
    const streamer = this.streamers.get(id);
    if (streamer) {
      streamer.stop();
      this.streamers.delete(id);
    }

    // Stop analytics watching
    this.analyticsService?.stopWatching(id);
    this.analyticsService?.recordEvent(id, "session_stop", undefined, row.provider_id);

    // Update DB (may fail if DB was closed during shutdown)
    try {
      this.db.run(
        "UPDATE sessions SET status = 'stopped', updated_at = unixepoch() WHERE id = ?",
        [id],
      );
    } catch {
      // DB may have been closed already
    }
  }

  // ── I/O forwarding ────────────────────────────────────────

  async sendInput(id: string, text: string): Promise<void> {
    const row = this.getRunningRow(id);
    const tmux = this.getTmux(row.user_id ?? undefined);
    await tmux.sendText(row.tmux_name, text);
  }

  async sendKeys(id: string, keys: string): Promise<void> {
    const row = this.getRunningRow(id);
    const tmux = this.getTmux(row.user_id ?? undefined);
    await tmux.sendKeys(row.tmux_name, keys);
  }

  async resizeTerminal(id: string, cols: number, rows: number): Promise<void> {
    const row = this.getRunningRow(id);
    const tmux = this.getTmux(row.user_id ?? undefined);
    await tmux.resizeWindow(row.tmux_name, cols, rows);
  }

  // ── Streamer access ───────────────────────────────────────

  getStreamer(id: string): SessionStreamer | undefined {
    return this.streamers.get(id);
  }

  // ── Queries ───────────────────────────────────────────────

  listSessions(
    status?: SessionStatus,
    providerId?: string,
    userId?: string,
  ): Session[] {
    let sql = "SELECT * FROM sessions WHERE 1=1";
    const params: string[] = [];

    if (userId) {
      sql += " AND user_id = ?";
      params.push(userId);
    }
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (providerId) {
      sql += " AND provider_id = ?";
      params.push(providerId);
    }
    sql += " ORDER BY created_at DESC";

    return this.db
      .query<SessionRow, string[]>(sql)
      .all(...params)
      .map((r) => this.rowToSession(r));
  }

  getSession(id: string): Session | null {
    const row = this.getRow(id);
    return row ? this.rowToSession(row) : null;
  }

  /** Check if a session belongs to a specific user. */
  isSessionOwner(sessionId: string, userId: string): boolean {
    const row = this.getRow(sessionId);
    if (!row) return false;
    // Legacy sessions without user_id are accessible to all (backward compat)
    if (!row.user_id) return true;
    return row.user_id === userId;
  }

  // ── Cleanup ───────────────────────────────────────────────

  /** Stop all streamers (for graceful shutdown). */
  stopAll(): void {
    for (const [, streamer] of this.streamers) {
      streamer.stop();
    }
    this.streamers.clear();
  }

  // ── Internals ─────────────────────────────────────────────

  private getRow(id: string): SessionRow | null {
    return (
      this.db
        .query<SessionRow, [string]>("SELECT * FROM sessions WHERE id = ?")
        .get(id) ?? null
    );
  }

  private getRunningRow(id: string): SessionRow {
    const row = this.getRow(id);
    if (!row) throw new Error("Session not found");
    if (row.status !== "running" && row.status !== "starting") {
      throw new Error(`Session is not running (status: ${row.status})`);
    }
    return row;
  }

  private ensureStreamer(id: string, _tmuxName: string): void {
    if (this.streamers.has(id)) return;

    const outputPath = join(this.dataDir, "sessions", id, "output.log");
    if (!existsSync(outputPath)) return;

    const streamer = new SessionStreamer(id, outputPath);
    streamer.start();
    this.streamers.set(id, streamer);
  }

  private rowToSession(row: SessionRow): Session {
    return {
      id: row.id as SessionId,
      name: row.name,
      providerId: row.provider_id as Session["providerId"],
      model: row.model,
      status: row.status as SessionStatus,
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000),
      pid: row.pid,
      tmuxSessionName: row.tmux_name,
      workDir: row.work_dir,
      conversationId: row.conversation_id,
    };
  }

  /**
   * Resolve a provider ID + model into a spawn command.
   * This is a simple mapping; full provider adapters come later.
   * Protected so tests can override it.
   */
  protected resolveSpawnCommand(
    providerId: string,
    _model: string,
  ): { command: string; args: string[] } {
    switch (providerId) {
      case "claude-code":
        return { command: "claude", args: [] };
      case "openai-codex":
        return { command: "codex", args: [] };
      case "gemini-cli":
        return { command: "gemini", args: [] };
      case "deepseek":
        return { command: "deepseek", args: [] };
      case "openclaw":
        return { command: "openclaw", args: [] };
      case "shell":
        return { command: "bash", args: ["-l"] };
      default:
        throw new Error(`No spawn command for provider: ${providerId}`);
    }
  }
}

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

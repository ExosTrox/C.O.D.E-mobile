// ── TmuxService ─────────────────────────────────────────────
// Low-level wrapper around the tmux CLI using Bun.spawn.
// Supports remote execution via SSH tunnel.

import type { Subprocess } from "bun";

export interface RemoteSSHConfig {
  host: string;       // e.g. "localhost"
  port: number;       // e.g. 2222
  user: string;       // e.g. "go"
  identityFile: string; // e.g. "/root/.ssh/id_ed25519_codemobile"
}

export class TmuxError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "TmuxError";
  }
}

export class TmuxService {
  private readonly remote?: RemoteSSHConfig;
  private tailProcesses = new Map<string, Subprocess>();

  constructor(remote?: RemoteSSHConfig) {
    this.remote = remote;
  }

  // ── Core executor ─────────────────────────────────────────

  private async exec(args: string[]): Promise<string> {
    const cmd = this.remote
      ? [
          "ssh",
          "-p", String(this.remote.port),
          "-i", this.remote.identityFile,
          "-o", "StrictHostKeyChecking=no",
          "-o", "ConnectTimeout=5",
          `${this.remote.user}@${this.remote.host}`,
          "tmux", ...args,
        ]
      : ["tmux", ...args];

    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
    });

    // Read both streams in parallel to avoid deadlock
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      this.throwTmuxError(stderr, exitCode);
    }

    return stdout.trimEnd();
  }

  private throwTmuxError(stderr: string, exitCode: number): never {
    const msg = stderr.trim();

    if (msg.includes("session not found") || msg.includes("can't find session")) {
      throw new TmuxError("SESSION_NOT_FOUND", `Tmux session not found: ${msg}`);
    }
    if (
      msg.includes("no server running") ||
      msg.includes("server not found") ||
      msg.includes("error connecting")
    ) {
      throw new TmuxError("SERVER_NOT_RUNNING", "Tmux server is not running");
    }
    if (msg.includes("duplicate session")) {
      throw new TmuxError("DUPLICATE_SESSION", `Tmux session already exists: ${msg}`);
    }

    throw new TmuxError("TMUX_ERROR", msg || `tmux exited with code ${exitCode}`);
  }

  // ── Session management ────────────────────────────────────

  async createSession(
    name: string,
    command: string,
    args: string[],
    env: Record<string, string>,
  ): Promise<void> {
    // Build shell command with env-var prefix
    const envPrefix = Object.entries(env)
      .map(([k, v]) => `${k}=${shellEscape(v)}`)
      .join(" ");
    const cmdStr = [command, ...args].map((a) => shellEscape(a)).join(" ");
    const fullCommand = envPrefix ? `env ${envPrefix} ${cmdStr}` : cmdStr;

    await this.exec([
      "new-session",
      "-d",
      "-s",
      name,
      "-x",
      "120",
      "-y",
      "40",
      fullCommand,
    ]);
  }

  async killSession(name: string): Promise<void> {
    await this.exec(["kill-session", "-t", name]);
    // Clean up remote tail process if any
    const tailProc = this.tailProcesses.get(name);
    if (tailProc) {
      tailProc.kill();
      this.tailProcesses.delete(name);
    }
    // Clean up remote log file
    if (this.remote) {
      Bun.spawn([
        "ssh", "-p", String(this.remote.port),
        "-i", this.remote.identityFile,
        "-o", "StrictHostKeyChecking=no",
        `${this.remote.user}@${this.remote.host}`,
        "rm", "-f", `/tmp/cm-${name}.log`,
      ]);
    }
  }

  // ── I/O ───────────────────────────────────────────────────

  /**
   * Send keys to a tmux session (interprets special keys).
   * Examples: "Enter", "C-c", "C-d", "Escape", "Up"
   */
  async sendKeys(name: string, keys: string): Promise<void> {
    await this.exec(["send-keys", "-t", name, keys]);
  }

  /**
   * Send literal text (no key interpretation, uses -l flag).
   */
  async sendText(name: string, text: string): Promise<void> {
    await this.exec(["send-keys", "-t", name, "-l", text]);
  }

  // ── Capture / resize ──────────────────────────────────────

  /** Return last 1000 lines of scrollback. */
  async capturePane(name: string): Promise<string> {
    return this.exec(["capture-pane", "-t", name, "-p", "-S", "-1000"]);
  }

  async resizeWindow(name: string, cols: number, rows: number): Promise<void> {
    await this.exec([
      "resize-window",
      "-t",
      name,
      "-x",
      String(cols),
      "-y",
      String(rows),
    ]);
  }

  // ── Listing / monitoring ──────────────────────────────────

  async listSessions(): Promise<{ name: string; activity: number }[]> {
    try {
      const output = await this.exec([
        "list-sessions",
        "-F",
        "#{session_name}:#{session_activity}",
      ]);
      if (!output) return [];
      return output.split("\n").map((line) => {
        const idx = line.lastIndexOf(":");
        const name = line.slice(0, idx);
        const activity = parseInt(line.slice(idx + 1), 10);
        return { name, activity };
      });
    } catch (err) {
      if (err instanceof TmuxError && err.code === "SERVER_NOT_RUNNING") {
        return [];
      }
      throw err;
    }
  }

  /**
   * Pipe all terminal output from the pane to a file (append mode).
   * For remote sessions, pipes to a temp file on the remote host,
   * then streams it back to the local file via SSH tail -f.
   */
  async pipePaneToFile(name: string, filePath: string): Promise<void> {
    if (this.remote) {
      // Pipe tmux output to a temp file on the Mac
      const remoteLogPath = `/tmp/cm-${name}.log`;
      await this.exec(["pipe-pane", "-t", name, "-o", `cat >> ${shellEscape(remoteLogPath)}`]);

      // Ensure the remote file exists
      Bun.spawn([
        "ssh", "-p", String(this.remote.port),
        "-i", this.remote.identityFile,
        "-o", "StrictHostKeyChecking=no",
        `${this.remote.user}@${this.remote.host}`,
        "touch", remoteLogPath,
      ]);

      // Start a background SSH process to tail the remote file into the local file
      const localFile = Bun.file(filePath);
      const writer = localFile.writer();
      const tailProc = Bun.spawn([
        "ssh", "-p", String(this.remote.port),
        "-i", this.remote.identityFile,
        "-o", "StrictHostKeyChecking=no",
        `${this.remote.user}@${this.remote.host}`,
        "tail", "-f", "-c", "+0", remoteLogPath,
      ], {
        stdout: "pipe",
        stderr: "ignore",
      });

      // Pipe remote tail output to local file
      (async () => {
        const reader = tailProc.stdout.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(value);
            writer.flush();
          }
        } catch {
          // Connection lost or session ended
        }
      })();

      this.tailProcesses.set(name, tailProc);
    } else {
      await this.exec(["pipe-pane", "-t", name, "-o", `cat >> ${shellEscape(filePath)}`]);
    }
  }

  /** Check whether a specific session exists. */
  async hasSession(name: string): Promise<boolean> {
    try {
      await this.exec(["has-session", "-t", name]);
      return true;
    } catch (err) {
      if (err instanceof TmuxError && err.code === "SESSION_NOT_FOUND") {
        return false;
      }
      if (err instanceof TmuxError && err.code === "SERVER_NOT_RUNNING") {
        return false;
      }
      throw err;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────

/** POSIX-safe shell escape: wraps in single-quotes if needed. */
function shellEscape(s: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

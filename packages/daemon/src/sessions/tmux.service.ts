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
  private tailRestartTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(remote?: RemoteSSHConfig) {
    this.remote = remote;
  }

  /** Build SSH args for running a command on the remote host with proper PATH */
  private sshArgs(remoteCmd: string): string[] {
    const r = this.remote!;
    return [
      "ssh",
      "-p", String(r.port),
      "-i", r.identityFile,
      "-o", "StrictHostKeyChecking=no",
      "-o", "ConnectTimeout=5",
      `${r.user}@${r.host}`,
      `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && ${remoteCmd}`,
    ];
  }

  // ── Core executor ─────────────────────────────────────────

  private async exec(args: string[]): Promise<string> {
    const cmd = this.remote
      ? this.sshArgs(`tmux ${args.map(a => shellEscape(a)).join(" ")}`)
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
    this.cleanupTailProcess(name);
  }

  /** Stop tail process and cleanup timers for a session. */
  cleanupTailProcess(name: string): void {
    const tailProc = this.tailProcesses.get(name);
    if (tailProc) {
      tailProc.kill();
      this.tailProcesses.delete(name);
    }
    const timer = this.tailRestartTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.tailRestartTimers.delete(name);
    }
    // Clean up remote log file
    if (this.remote) {
      Bun.spawn(this.sshArgs(`rm -f /tmp/cm-${shellEscape(name)}.log`));
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
      const remoteLogPath = `/tmp/cm-${name}.log`;
      console.log(`[TmuxService] Setting up pipe-pane: ${name} → ${remoteLogPath} → ${filePath}`);
      // Don't use -o flag — it's a toggle that CLOSES the pipe if one already exists
      await this.exec(["pipe-pane", "-t", name, `cat >> ${shellEscape(remoteLogPath)}`]);

      // Capture the current pane content (e.g. shell prompt) that was output
      // BEFORE pipe-pane was set up, and append it to the log file.
      // Use >> to avoid overwriting any output pipe-pane may have already captured.
      try {
        const captureCmd = `tmux capture-pane -t ${shellEscape(name)} -p >> ${shellEscape(remoteLogPath)}`;
        const proc = Bun.spawn(this.sshArgs(captureCmd), { stdout: "ignore", stderr: "pipe" });
        const captureExit = await proc.exited;
        if (captureExit !== 0) {
          const stderr = await new Response(proc.stderr).text();
          console.warn(`[TmuxService] capture-pane failed for ${name} (exit ${captureExit}): ${stderr.trim()}`);
        } else {
          console.log(`[TmuxService] capture-pane succeeded for ${name}`);
        }
      } catch (err) {
        console.warn(`[TmuxService] capture-pane error for ${name}:`, err);
      }

      // Send Enter to trigger a fresh prompt that pipe-pane WILL capture
      // (ensures there's visible output even if the shell was idle)
      try {
        await this.exec(["send-keys", "-t", name, ""]);
        await this.exec(["send-keys", "-t", name, "Enter"]);
      } catch { /* ignore */ }

      // Start tail and auto-restart on disconnect
      this.startTailPipe(name, remoteLogPath, filePath);
    } else {
      await this.exec(["pipe-pane", "-t", name, `cat >> ${shellEscape(filePath)}`]);
    }
  }

  /** Start a tail -f SSH process that pipes remote output to the local file.
   *  Auto-restarts if the SSH connection drops. */
  private startTailPipe(name: string, remoteLogPath: string, localFilePath: string): void {
    // Kill existing tail process for this session
    const existing = this.tailProcesses.get(name);
    if (existing) {
      existing.kill();
      this.tailProcesses.delete(name);
    }

    // Clear any pending restart timer
    const existingTimer = this.tailRestartTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.tailRestartTimers.delete(name);
    }

    const localFile = Bun.file(localFilePath);
    const writer = localFile.writer();

    // Get the current local file size to use as offset for tail
    let localSize = 0;
    try { localSize = Bun.file(localFilePath).size; } catch { /* ignore */ }

    // Start tail from the byte offset matching what we already have locally
    const tailCmd = localSize > 0
      ? `tail -f -c +${localSize + 1} ${shellEscape(remoteLogPath)}`
      : `tail -f -c +0 ${shellEscape(remoteLogPath)}`;

    console.log(`[TmuxService] Starting tail -f SSH pipe for ${name}: ${tailCmd}`);
    const tailProc = Bun.spawn(this.sshArgs(tailCmd), {
      stdout: "pipe",
      stderr: "pipe",
    });
    this.tailProcesses.set(name, tailProc);

    // Check if tail process exits immediately (e.g. SSH auth failure)
    void tailProc.exited.then((code) => {
      if (code !== 0) {
        console.error(`[TmuxService] tail process for ${name} exited with code ${code}`);
      }
    });

    // Log stderr from tail process for debugging
    (async () => {
      try {
        const stderr = await new Response(tailProc.stderr).text();
        if (stderr.trim()) {
          console.warn(`[TmuxService] tail stderr for ${name}: ${stderr.trim()}`);
        }
      } catch { /* ignore */ }
    })();

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
      } finally {
        // Always close the writer to avoid fd leak
        try { writer.end(); } catch { /* ignore */ }
      }
      console.warn(`[TmuxService] tail process exited for ${name}, scheduling restart`);

      // Tail process exited — schedule restart if session still active
      const restartTimer = setTimeout(async () => {
        this.tailRestartTimers.delete(name);
        // Only restart if this session still exists in our tracking
        if (!this.tailProcesses.has(name)) return;
        try {
          // Verify the remote tmux session still exists
          const alive = await this.hasSession(name);
          if (alive) {
            // Re-enable pipe-pane (it may have been lost with the tmux server restart)
            try {
              await this.exec(["pipe-pane", "-t", name, `cat >> ${shellEscape(remoteLogPath)}`]);
            } catch { /* ignore */ }
            this.startTailPipe(name, remoteLogPath, localFilePath);
          }
        } catch {
          // SSH still down — try again in 10s, but only if session not killed
          if (!this.tailProcesses.has(name)) return;
          const retryTimer = setTimeout(() => {
            this.tailRestartTimers.delete(name);
            if (this.tailProcesses.has(name)) {
              this.startTailPipe(name, remoteLogPath, localFilePath);
            }
          }, 10_000);
          this.tailRestartTimers.set(name, retryTimer);
        }
      }, 3_000); // Wait 3s before restart attempt
      this.tailRestartTimers.set(name, restartTimer);
    })();
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

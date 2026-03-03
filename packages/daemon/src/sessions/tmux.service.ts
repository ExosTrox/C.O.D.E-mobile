// ── TmuxService ─────────────────────────────────────────────
// Low-level wrapper around the tmux CLI using Bun.spawn.

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
  // ── Core executor ─────────────────────────────────────────

  private async exec(args: string[]): Promise<string> {
    const proc = Bun.spawn(["tmux", ...args], {
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
   * This captures every byte written to the terminal.
   */
  async pipePaneToFile(name: string, filePath: string): Promise<void> {
    await this.exec(["pipe-pane", "-t", name, "-o", `cat >> ${shellEscape(filePath)}`]);
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

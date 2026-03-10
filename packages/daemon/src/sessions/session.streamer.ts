// ── SessionStreamer ──────────────────────────────────────────
// Watches a session output file and emits new data in real-time.
// Uses fs.watch + debounce at 16 ms (~60 fps) for smooth rendering.

import { EventEmitter } from "events";
import { watch, statSync, writeFileSync, existsSync } from "fs";
import type { FSWatcher } from "fs";

export interface StreamChunk {
  bytes: Uint8Array;
  offset: number;
}

export class SessionStreamer extends EventEmitter {
  private offset = 0;
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(
    readonly sessionId: string,
    private readonly outputPath: string,
  ) {
    super();
  }

  // ── Lifecycle ─────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;

    // Ensure output file exists
    if (!existsSync(this.outputPath)) {
      writeFileSync(this.outputPath, "");
    }

    // Start from offset 0 — stream ALL data including initial output.
    // Clients that subscribe later get history via getHistory().
    // This ensures nothing is missed between pipe-pane setup and streamer start.
    this.offset = 0;

    this.watcher = watch(this.outputPath, () => {
      this.scheduleFlush();
    });

    // Handle watcher errors gracefully
    this.watcher.on("error", () => {
      // Don't stop — keep polling
    });

    // Polling fallback: fs.watch can miss events for files written via SSH pipe.
    // Poll every 500ms to catch any changes fs.watch missed.
    this.pollTimer = setInterval(() => {
      this.scheduleFlush();
    }, 500);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.started = false;
    this.removeAllListeners();
  }

  // ── History (for reconnection) ────────────────────────────

  /**
   * Read output starting at `fromOffset` (0 = beginning of file).
   * Used when a client reconnects and needs to catch up on missed data.
   */
  async getHistory(fromOffset = 0): Promise<StreamChunk> {
    const file = Bun.file(this.outputPath);
    const size = file.size;

    if (size <= fromOffset) {
      return { bytes: new Uint8Array(0), offset: fromOffset };
    }

    const slice = file.slice(fromOffset, size);
    const bytes = new Uint8Array(await slice.arrayBuffer());
    return { bytes, offset: fromOffset };
  }

  /** Current byte offset (end of file as last seen). */
  get currentOffset(): number {
    return this.offset;
  }

  // ── Internals ─────────────────────────────────────────────

  private scheduleFlush(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, 16); // ~60 fps
  }

  private async flush(): Promise<void> {
    try {
      const size = statSync(this.outputPath).size;
      if (size <= this.offset) return;

      const file = Bun.file(this.outputPath);
      const slice = file.slice(this.offset, size);
      const bytes = new Uint8Array(await slice.arrayBuffer());
      const prevOffset = this.offset;
      this.offset = size;

      this.emit("data", { bytes, offset: prevOffset } satisfies StreamChunk);
    } catch {
      // File may have been removed (session ended)
    }
  }
}

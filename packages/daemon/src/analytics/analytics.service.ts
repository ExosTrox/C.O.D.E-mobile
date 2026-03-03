// ── Analytics Service ──────────────────────────────────────────
// Watches provider output files (JSONL or text) and extracts token analytics.

import { watch, type FSWatcher } from "node:fs";
import { readFileSync } from "node:fs";
import type { Database } from "bun:sqlite";

/** Token usage analytics (mirrors @code-mobile/providers TokenAnalytics). */
interface TokenAnalytics {
  inputTokens: number;
  outputTokens: number;
  cacheHits?: number;
  estimatedCost?: number;
}

/** Minimal adapter interface for analytics parsing. */
interface AnalyticsAdapter {
  parseAnalytics?(output: string): TokenAnalytics | null;
}

// ── DB row shape ──────────────────────────────────────────────

interface AnalyticsRow {
  id: string;
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_hits: number | null;
  estimated_cost: number | null;
  recorded_at: number;
}

export interface SessionAnalytics {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheHits: number;
  totalEstimatedCost: number;
  snapshots: AnalyticsSnapshot[];
}

export interface AnalyticsSnapshot {
  id: string;
  inputTokens: number;
  outputTokens: number;
  cacheHits: number | null;
  estimatedCost: number | null;
  recordedAt: number;
}

// ── Service ───────────────────────────────────────────────────

export class AnalyticsService {
  private watchers = new Map<string, FSWatcher>();
  private fileOffsets = new Map<string, number>();

  constructor(
    private readonly db: Database,
    private readonly adapters: Map<string, AnalyticsAdapter>,
  ) {}

  /**
   * Start watching a session's output file for analytics data.
   */
  startWatching(sessionId: string, providerId: string, outputPath: string): void {
    if (this.watchers.has(sessionId)) return;

    const adapter = this.adapters.get(providerId);
    if (!adapter?.parseAnalytics) return;

    this.fileOffsets.set(sessionId, 0);

    try {
      const watcher = watch(outputPath, () => {
        this.processNewOutput(sessionId, providerId, outputPath);
      });
      this.watchers.set(sessionId, watcher);
    } catch {
      // File may not exist yet; that's OK — we'll be started again on reconnect
    }
  }

  /**
   * Stop watching a session's output file.
   */
  stopWatching(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
      this.fileOffsets.delete(sessionId);
    }
  }

  /**
   * Stop all watchers.
   */
  stopAll(): void {
    for (const [id] of this.watchers) {
      this.stopWatching(id);
    }
  }

  /**
   * Record a single analytics snapshot for a session.
   */
  record(sessionId: string, analytics: TokenAnalytics): void {
    this.db.run(
      `INSERT INTO session_analytics (id, session_id, input_tokens, output_tokens, cache_hits, estimated_cost)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        sessionId,
        analytics.inputTokens,
        analytics.outputTokens,
        analytics.cacheHits ?? null,
        analytics.estimatedCost ?? null,
      ],
    );
  }

  /**
   * Get aggregated analytics for a session.
   */
  getSessionAnalytics(sessionId: string): SessionAnalytics {
    const rows = this.db
      .query<AnalyticsRow, [string]>(
        "SELECT * FROM session_analytics WHERE session_id = ? ORDER BY recorded_at",
      )
      .all(sessionId);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheHits = 0;
    let totalEstimatedCost = 0;

    const snapshots: AnalyticsSnapshot[] = rows.map((row) => {
      totalInputTokens += row.input_tokens;
      totalOutputTokens += row.output_tokens;
      totalCacheHits += row.cache_hits ?? 0;
      totalEstimatedCost += row.estimated_cost ?? 0;
      return {
        id: row.id,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheHits: row.cache_hits,
        estimatedCost: row.estimated_cost,
        recordedAt: row.recorded_at,
      };
    });

    return {
      sessionId,
      totalInputTokens,
      totalOutputTokens,
      totalCacheHits,
      totalEstimatedCost,
      snapshots,
    };
  }

  /**
   * Get latest cumulative totals for a session (for quick display).
   */
  getLatestTotals(sessionId: string): TokenAnalytics {
    const row = this.db
      .query<
        { total_input: number; total_output: number; total_cache: number; total_cost: number },
        [string]
      >(
        `SELECT
           COALESCE(SUM(input_tokens), 0) as total_input,
           COALESCE(SUM(output_tokens), 0) as total_output,
           COALESCE(SUM(cache_hits), 0) as total_cache,
           COALESCE(SUM(estimated_cost), 0) as total_cost
         FROM session_analytics WHERE session_id = ?`,
      )
      .get(sessionId);

    return {
      inputTokens: row?.total_input ?? 0,
      outputTokens: row?.total_output ?? 0,
      cacheHits: row?.total_cache ?? 0,
      estimatedCost: row?.total_cost ?? 0,
    };
  }

  // ── Internals ─────────────────────────────────────────────

  private processNewOutput(sessionId: string, providerId: string, outputPath: string): void {
    const adapter = this.adapters.get(providerId);
    if (!adapter?.parseAnalytics) return;

    try {
      const content = readFileSync(outputPath, "utf-8");
      const currentOffset = this.fileOffsets.get(sessionId) ?? 0;
      const newContent = content.slice(currentOffset);
      this.fileOffsets.set(sessionId, content.length);

      if (!newContent) return;

      // Process each line for analytics
      const lines = newContent.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const analytics = adapter.parseAnalytics(line);
        if (analytics) {
          this.record(sessionId, analytics);
        }
      }
    } catch {
      // File read errors are non-fatal
    }
  }
}

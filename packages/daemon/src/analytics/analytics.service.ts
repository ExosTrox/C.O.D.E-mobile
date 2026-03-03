// ── Analytics Service ──────────────────────────────────────────
// Watches provider output files and tracks analytics events.

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

// ── DB row shapes ────────────────────────────────────────────

interface AnalyticsRow {
  id: string;
  session_id: string;
  input_tokens: number;
  output_tokens: number;
  cache_hits: number | null;
  estimated_cost: number | null;
  recorded_at: number;
}

interface EventRow {
  id: string;
  session_id: string | null;
  event_type: string;
  provider_id: string | null;
  data: string | null;
  created_at: number;
}

export type AnalyticsEventType =
  | "session_start"
  | "session_stop"
  | "tokens_used"
  | "command_sent"
  | "error";

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

export interface AnalyticsOverview {
  totalSessions: number;
  activeSessions: number;
  totalTokens: number;
  estimatedCost: number;
  mostUsedProvider: string | null;
}

export interface ProviderBreakdown {
  providerId: string;
  sessionCount: number;
  tokenCount: number;
  costEstimate: number;
}

export interface UsageTrendPoint {
  timestamp: number;
  sessions: number;
  tokens: number;
  cost: number;
}

// ── Service ───────────────────────────────────────────────────

export class AnalyticsService {
  private watchers = new Map<string, FSWatcher>();
  private fileOffsets = new Map<string, number>();

  constructor(
    private readonly db: Database,
    private readonly adapters: Map<string, AnalyticsAdapter>,
  ) {}

  // ── Event recording ────────────────────────────────────────

  recordEvent(
    sessionId: string | null,
    type: AnalyticsEventType,
    data?: Record<string, unknown>,
    providerId?: string,
  ): void {
    this.db.run(
      `INSERT INTO analytics_events (id, session_id, event_type, provider_id, data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        sessionId,
        type,
        providerId ?? null,
        data ? JSON.stringify(data) : null,
      ],
    );
  }

  // ── Overview ──────────────────────────────────────────────

  getOverview(period: "24h" | "7d" | "30d"): AnalyticsOverview {
    const since = this.periodToTimestamp(period);

    const sessions = this.db
      .query<{ count: number }, [number]>(
        `SELECT COUNT(DISTINCT session_id) as count FROM analytics_events
         WHERE event_type = 'session_start' AND created_at >= ?`,
      )
      .get(since);

    const active = this.db
      .query<{ count: number }, []>(
        "SELECT COUNT(*) as count FROM sessions WHERE status IN ('starting', 'running')",
      )
      .get();

    const tokens = this.db
      .query<{ total_input: number; total_output: number; total_cost: number }, [number]>(
        `SELECT
           COALESCE(SUM(input_tokens), 0) as total_input,
           COALESCE(SUM(output_tokens), 0) as total_output,
           COALESCE(SUM(estimated_cost), 0) as total_cost
         FROM session_analytics WHERE recorded_at >= ?`,
      )
      .get(since);

    const topProvider = this.db
      .query<{ provider_id: string }, [number]>(
        `SELECT provider_id FROM analytics_events
         WHERE event_type = 'session_start' AND provider_id IS NOT NULL AND created_at >= ?
         GROUP BY provider_id ORDER BY COUNT(*) DESC LIMIT 1`,
      )
      .get(since);

    return {
      totalSessions: sessions?.count ?? 0,
      activeSessions: active?.count ?? 0,
      totalTokens: (tokens?.total_input ?? 0) + (tokens?.total_output ?? 0),
      estimatedCost: tokens?.total_cost ?? 0,
      mostUsedProvider: topProvider?.provider_id ?? null,
    };
  }

  // ── Session analytics ─────────────────────────────────────

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

  // ── Provider breakdown ────────────────────────────────────

  getProviderBreakdown(period: "24h" | "7d" | "30d"): ProviderBreakdown[] {
    const since = this.periodToTimestamp(period);

    return this.db
      .query<
        { provider_id: string; session_count: number; token_count: number; cost_estimate: number },
        [number]
      >(
        `SELECT
           s.provider_id,
           COUNT(DISTINCT s.id) as session_count,
           COALESCE(SUM(sa.input_tokens + sa.output_tokens), 0) as token_count,
           COALESCE(SUM(sa.estimated_cost), 0) as cost_estimate
         FROM sessions s
         LEFT JOIN session_analytics sa ON sa.session_id = s.id AND sa.recorded_at >= ?
         WHERE s.created_at >= ?
         GROUP BY s.provider_id
         ORDER BY token_count DESC`,
      )
      .all(since)
      .map((row) => ({
        providerId: row.provider_id,
        sessionCount: row.session_count,
        tokenCount: row.token_count,
        costEstimate: row.cost_estimate,
      }));
  }

  // ── Usage trend ───────────────────────────────────────────

  getUsageTrend(period: "24h" | "7d" | "30d", granularity: "hour" | "day"): UsageTrendPoint[] {
    const since = this.periodToTimestamp(period);
    const bucket = granularity === "hour" ? 3600 : 86400;

    return this.db
      .query<
        { bucket_start: number; sessions: number; tokens: number; cost: number },
        [number, number]
      >(
        `SELECT
           (recorded_at / ? * ?) as bucket_start,
           COUNT(DISTINCT session_id) as sessions,
           COALESCE(SUM(input_tokens + output_tokens), 0) as tokens,
           COALESCE(SUM(estimated_cost), 0) as cost
         FROM session_analytics
         WHERE recorded_at >= ?
         GROUP BY bucket_start
         ORDER BY bucket_start`,
      )
      .all(bucket, since)
      .map((row) => ({
        timestamp: row.bucket_start,
        sessions: row.sessions,
        tokens: row.tokens,
        cost: row.cost,
      }));
  }

  // ── Token analytics (file-based) ─────────────────────────

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

  // ── File watching ──────────────────────────────────────────

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
      // File may not exist yet
    }
  }

  stopWatching(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
      this.fileOffsets.delete(sessionId);
    }
  }

  stopAll(): void {
    for (const [id] of this.watchers) {
      this.stopWatching(id);
    }
  }

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

  private periodToTimestamp(period: "24h" | "7d" | "30d"): number {
    const now = Math.floor(Date.now() / 1000);
    switch (period) {
      case "24h":
        return now - 86400;
      case "7d":
        return now - 7 * 86400;
      case "30d":
        return now - 30 * 86400;
    }
  }
}

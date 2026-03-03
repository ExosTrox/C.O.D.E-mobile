// ── Provider Adapter Types ──────────────────────────────────

import type { ProviderId } from "@code-mobile/core";

/** Configuration passed to getSpawnCommand. */
export interface SpawnOptions {
  model: string;
  workDir: string;
  args?: string[];
}

/** Fully-resolved spawn configuration for tmux. */
export interface SpawnConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
  cwd?: string;
}

/** Token usage analytics parsed from provider output. */
export interface TokenAnalytics {
  inputTokens: number;
  outputTokens: number;
  cacheHits?: number;
  estimatedCost?: number;
}

/** The contract every provider adapter must implement. */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly name: string;

  /** Check whether the CLI / binary is installed and reachable. */
  isAvailable(): Promise<boolean>;

  /** Human-readable install instructions shown in UI. */
  getInstallInstructions(): string;

  /**
   * Build the spawn config for creating a tmux session.
   * @param options  Model, workDir, extra args
   * @param apiKey   Optional API key (injected as env var)
   */
  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig;

  /**
   * Optional: parse token analytics from provider output lines.
   * Returns null if the line doesn't contain analytics data.
   */
  parseAnalytics?(output: string): TokenAnalytics | null;
}

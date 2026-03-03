/**
 * @code-mobile/providers
 * Pluggable AI provider adapter system.
 */

// ── Types ──────────────────────────────────────────────────
export type {
  ProviderAdapter,
  SpawnConfig,
  SpawnOptions,
  TokenAnalytics,
} from "./types.js";

// ── Adapters ───────────────────────────────────────────────
export { ClaudeCodeAdapter } from "./adapters/claude-code.js";
export { OpenAICodexAdapter } from "./adapters/openai-codex.js";
export { GeminiCLIAdapter } from "./adapters/gemini-cli.js";
export { DeepSeekAdapter } from "./adapters/deepseek.js";
export { OpenClawAdapter } from "./adapters/openclaw.js";

// ── Registry ───────────────────────────────────────────────
export { ProviderRegistry, createDefaultRegistry } from "./registry.js";
export type { ProviderStatus } from "./registry.js";

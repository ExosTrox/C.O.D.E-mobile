// ── Provider Registry ───────────────────────────────────────

import type { ProviderId } from "@code-mobile/core";
import type { ProviderAdapter } from "./types.js";
import { ClaudeCodeAdapter } from "./adapters/claude-code.js";
import { OpenAICodexAdapter } from "./adapters/openai-codex.js";
import { GeminiCLIAdapter } from "./adapters/gemini-cli.js";
import { DeepSeekAdapter } from "./adapters/deepseek.js";
import { OpenClawAdapter } from "./adapters/openclaw.js";

export class ProviderRegistry {
  private adapters = new Map<ProviderId, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: ProviderId): ProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }

  /** Check availability of all registered providers in parallel. */
  async checkAvailability(): Promise<Map<ProviderId, boolean>> {
    const entries = [...this.adapters.entries()];
    const results = await Promise.all(
      entries.map(async ([id, adapter]) => {
        try {
          const available = await adapter.isAvailable();
          return [id, available] as const;
        } catch {
          return [id, false] as const;
        }
      }),
    );
    return new Map(results);
  }
}

/** Create a registry pre-loaded with all built-in adapters. */
export function createDefaultRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new ClaudeCodeAdapter());
  registry.register(new OpenAICodexAdapter());
  registry.register(new GeminiCLIAdapter());
  registry.register(new DeepSeekAdapter());
  registry.register(new OpenClawAdapter());
  return registry;
}

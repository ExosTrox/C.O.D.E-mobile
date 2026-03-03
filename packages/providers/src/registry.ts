// ── Provider Registry ───────────────────────────────────────

import type { ProviderId } from "@code-mobile/core";
import type { ProviderAdapter } from "./types.js";
import { ClaudeCodeAdapter } from "./adapters/claude-code.js";
import { OpenAICodexAdapter } from "./adapters/openai-codex.js";
import { GeminiCLIAdapter } from "./adapters/gemini-cli.js";
import { DeepSeekAdapter } from "./adapters/deepseek.js";
import { OpenClawAdapter } from "./adapters/openclaw.js";

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  installInstructions: string;
}

export class ProviderRegistry {
  private adapters = new Map<ProviderId, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: ProviderId): ProviderAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Unknown provider: ${id}`);
    }
    return adapter;
  }

  has(id: ProviderId): boolean {
    return this.adapters.has(id);
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

  /** Get full status of all providers (availability + install instructions). */
  async checkAllProviders(): Promise<ProviderStatus[]> {
    const availability = await this.checkAvailability();
    return this.list().map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      available: availability.get(adapter.id) ?? false,
      installInstructions: adapter.getInstallInstructions(),
    }));
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

/**
 * @code-mobile/providers
 * AI provider adapters (pluggable system).
 */

export interface ProviderAdapter {
  readonly id: string;
  readonly name: string;
  getSpawnCommand(): { command: string; args: string[] };
  isInstalled(): Promise<boolean>;
}

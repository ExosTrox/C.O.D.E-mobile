// ── Gemini CLI Adapter ──────────────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions } from "../types.js";

export class GeminiCLIAdapter implements ProviderAdapter {
  readonly id = "gemini-cli" as const;
  readonly name = "Gemini CLI";

  async isAvailable(): Promise<boolean> {
    return commandExists("gemini");
  }

  getInstallInstructions(): string {
    return "npm install -g @google/gemini-cli";
  }

  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig {
    const args: string[] = [];
    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.GOOGLE_API_KEY = apiKey;
    if (options.model) env.GEMINI_MODEL = options.model;

    return {
      command: "gemini",
      args,
      env,
      cwd: options.workDir,
    };
  }
}

// ── Helpers ────────────────────────────────────────────────

async function commandExists(cmd: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", cmd], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

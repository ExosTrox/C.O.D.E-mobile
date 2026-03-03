// ── OpenAI Codex CLI Adapter ────────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions, TokenAnalytics } from "../types.js";

export class OpenAICodexAdapter implements ProviderAdapter {
  readonly id = "openai-codex" as const;
  readonly name = "OpenAI Codex CLI";

  async isAvailable(): Promise<boolean> {
    return commandExists("codex");
  }

  getInstallInstructions(): string {
    return "npm install -g @openai/codex";
  }

  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig {
    const args = ["--model", options.model, "--full-auto"];
    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.OPENAI_API_KEY = apiKey;

    return {
      command: "codex",
      args,
      env,
      cwd: options.workDir,
    };
  }

  parseAnalytics(output: string): TokenAnalytics | null {
    // Codex CLI outputs token usage like:
    //   Tokens: 1234 input, 567 output
    const match = output.match(/Tokens:\s*([0-9,]+)\s*input,\s*([0-9,]+)\s*output/);
    if (!match) return null;

    return {
      inputTokens: parseInt(match[1]?.replace(/,/g, "") ?? "0", 10),
      outputTokens: parseInt(match[2]?.replace(/,/g, "") ?? "0", 10),
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

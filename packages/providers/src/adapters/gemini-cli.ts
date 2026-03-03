// ── Gemini CLI Adapter ──────────────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions, TokenAnalytics } from "../types.js";

export class GeminiCLIAdapter implements ProviderAdapter {
  readonly id = "gemini-cli" as const;
  readonly name = "Gemini CLI";

  async isAvailable(): Promise<boolean> {
    return commandExists("gemini");
  }

  getInstallInstructions(): string {
    return "npm install -g @anthropic-ai/gemini-cli";
  }

  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig {
    const args = ["-m", options.model];
    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.GOOGLE_API_KEY = apiKey;

    return {
      command: "gemini",
      args,
      env,
      cwd: options.workDir,
    };
  }

  parseAnalytics(output: string): TokenAnalytics | null {
    // Gemini CLI outputs usage stats like:
    //   Token usage: 1234 input / 567 output
    //   Estimated cost: $0.0042
    const tokenMatch = output.match(/Token usage:\s*([0-9,]+)\s*input\s*\/\s*([0-9,]+)\s*output/);
    const costMatch = output.match(/Estimated cost:\s*\$([0-9.]+)/);

    if (!tokenMatch && !costMatch) return null;

    return {
      inputTokens: tokenMatch?.[1] ? parseInt(tokenMatch[1].replace(/,/g, ""), 10) : 0,
      outputTokens: tokenMatch?.[2] ? parseInt(tokenMatch[2].replace(/,/g, ""), 10) : 0,
      estimatedCost: costMatch?.[1] ? parseFloat(costMatch[1]) : undefined,
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

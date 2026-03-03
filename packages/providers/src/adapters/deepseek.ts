// ── DeepSeek Adapter (via aider) ────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions, TokenAnalytics } from "../types.js";

export class DeepSeekAdapter implements ProviderAdapter {
  readonly id = "deepseek" as const;
  readonly name = "DeepSeek";

  async isAvailable(): Promise<boolean> {
    return commandExists("aider");
  }

  getInstallInstructions(): string {
    return "pip install aider-chat";
  }

  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig {
    const args = ["--model", `deepseek/${options.model}`];
    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.DEEPSEEK_API_KEY = apiKey;

    return {
      command: "aider",
      args,
      env,
      cwd: options.workDir,
    };
  }

  parseAnalytics(output: string): TokenAnalytics | null {
    // Aider outputs cost lines like:
    //   Tokens: 1.2k sent, 0.5k received. Cost: $0.01
    const match = output.match(
      /Tokens:\s*([\d.]+)k?\s*sent,\s*([\d.]+)k?\s*received/,
    );
    const costMatch = output.match(/Cost:\s*\$([0-9.]+)/);
    if (!match) return null;

    const parseTokenCount = (s: string): number => {
      const n = parseFloat(s);
      return s.includes("k") || n < 100 ? Math.round(n * 1000) : Math.round(n);
    };

    return {
      inputTokens: parseTokenCount(match[1] ?? "0"),
      outputTokens: parseTokenCount(match[2] ?? "0"),
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

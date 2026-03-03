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
    const args = [
      "--model", `deepseek/${options.model}`,
      "--no-auto-commits",
      "--no-git",
    ];
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
    //   Tokens: 1200 sent, 500 received. Cost: $0.01
    const match = output.match(
      /Tokens:\s*([\d.]+)k?\s*sent,\s*([\d.]+)k?\s*received/,
    );
    const costMatch = output.match(/Cost:\s*\$([0-9.]+)/);
    if (!match) return null;

    const parseTokenCount = (raw: string, full: string): number => {
      const n = parseFloat(raw);
      // If the full match contains 'k' suffix or value is small enough to be thousands
      return full.match(new RegExp(`${raw.replace(".", "\\.")}k`)) ? Math.round(n * 1000) : Math.round(n);
    };

    return {
      inputTokens: match[1] ? parseTokenCount(match[1], output) : 0,
      outputTokens: match[2] ? parseTokenCount(match[2], output) : 0,
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

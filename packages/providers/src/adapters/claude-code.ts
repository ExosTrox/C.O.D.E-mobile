// ── Claude Code Adapter ─────────────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions, TokenAnalytics } from "../types.js";

export class ClaudeCodeAdapter implements ProviderAdapter {
  readonly id = "claude-code" as const;
  readonly name = "Claude Code";

  async isAvailable(): Promise<boolean> {
    return commandExists("claude");
  }

  getInstallInstructions(): string {
    return "npm install -g @anthropic-ai/claude-code";
  }

  getSpawnCommand(options: SpawnOptions, apiKey?: string): SpawnConfig {
    const args = ["--dangerously-skip-permissions"];
    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
    if (options.model) env.CLAUDE_MODEL = options.model;

    return {
      command: "claude",
      args,
      env,
      cwd: options.workDir,
    };
  }

  parseAnalytics(output: string): TokenAnalytics | null {
    // Claude Code outputs cost lines like:
    //   Total cost: $0.1234
    //   Total input tokens: 1234
    //   Total output tokens: 567
    const costMatch = output.match(/Total cost:\s*\$([0-9.]+)/);
    const inputMatch = output.match(/Total input tokens:\s*([0-9,]+)/);
    const outputMatch = output.match(/Total output tokens:\s*([0-9,]+)/);

    if (!inputMatch && !outputMatch && !costMatch) return null;

    return {
      inputTokens: inputMatch?.[1] ? parseInt(inputMatch[1].replace(/,/g, ""), 10) : 0,
      outputTokens: outputMatch?.[1] ? parseInt(outputMatch[1].replace(/,/g, ""), 10) : 0,
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

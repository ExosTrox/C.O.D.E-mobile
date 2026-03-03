// ── Claude Code Adapter ─────────────────────────────────────

import { writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";
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

    // Session resume support
    if (options.conversationId) {
      args.push("--resume", "--conversation-id", options.conversationId);
    }

    if (options.args) args.push(...options.args);

    const env: Record<string, string> = {};
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey;
    if (options.model) env.CLAUDE_MODEL = options.model;

    // Generate hooks if daemon integration is configured
    if (options.dataDir && options.sessionId && options.daemonUrl) {
      const hookPaths = this.generateHooks(
        options.dataDir,
        options.sessionId,
        options.daemonUrl,
      );
      env.CLAUDE_CODE_HOOKS_PRE_TOOL_USE = hookPaths.preToolUse;
      env.CLAUDE_CODE_HOOKS_POST_TOOL_USE = hookPaths.postToolUse;
      env.CLAUDE_CODE_HOOKS_NOTIFICATION = hookPaths.notification;
      env.CLAUDE_CODE_HOOKS_STOP = hookPaths.stop;
    }

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

  // ── Hook Generation ──────────────────────────────────────────

  /**
   * Generate bash hook scripts that bridge Claude Code events to the daemon.
   * Returns paths to the 4 hook scripts.
   */
  generateHooks(
    dataDir: string,
    sessionId: string,
    daemonUrl: string,
  ): { preToolUse: string; postToolUse: string; notification: string; stop: string } {
    const hooksDir = join(dataDir, "hooks", sessionId);
    mkdirSync(hooksDir, { recursive: true });

    const preToolUse = join(hooksDir, "pre-tool-use.sh");
    const postToolUse = join(hooksDir, "post-tool-use.sh");
    const notification = join(hooksDir, "notification.sh");
    const stop = join(hooksDir, "stop.sh");

    // Pre-tool-use: reads JSON from stdin, POSTs to daemon, blocks if denied
    writeFileSync(
      preToolUse,
      `#!/usr/bin/env bash
set -euo pipefail
INPUT=$(cat)
RESPONSE=$(echo "$INPUT" | curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d @- \\
  "${daemonUrl}/internal/hooks/${sessionId}/pre-tool-use")
ACTION=$(echo "$RESPONSE" | grep -o '"action":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$ACTION" = "deny" ]; then
  echo '{"action":"block","message":"Denied by mobile permission policy"}'
fi
`,
    );

    // Post-tool-use: fire-and-forget notification to daemon
    writeFileSync(
      postToolUse,
      `#!/usr/bin/env bash
set -euo pipefail
INPUT=$(cat)
echo "$INPUT" | curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d @- \\
  "${daemonUrl}/internal/hooks/${sessionId}/post-tool-use" > /dev/null 2>&1 &
`,
    );

    // Notification: forward to daemon for WebSocket broadcast
    writeFileSync(
      notification,
      `#!/usr/bin/env bash
set -euo pipefail
INPUT=$(cat)
echo "$INPUT" | curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d @- \\
  "${daemonUrl}/internal/hooks/${sessionId}/notification" > /dev/null 2>&1 &
`,
    );

    // Stop: notify daemon the session is ending
    writeFileSync(
      stop,
      `#!/usr/bin/env bash
set -euo pipefail
INPUT=$(cat)
echo "$INPUT" | curl -s -X POST \\
  -H "Content-Type: application/json" \\
  -d @- \\
  "${daemonUrl}/internal/hooks/${sessionId}/stop" > /dev/null 2>&1 &
`,
    );

    // Make all hooks executable
    chmodSync(preToolUse, 0o755);
    chmodSync(postToolUse, 0o755);
    chmodSync(notification, 0o755);
    chmodSync(stop, 0o755);

    return { preToolUse, postToolUse, notification, stop };
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

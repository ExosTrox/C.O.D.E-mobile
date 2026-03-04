// ── OpenClaw Adapter (Docker) ───────────────────────────────

import type { ProviderAdapter, SpawnConfig, SpawnOptions } from "../types.js";

export class OpenClawAdapter implements ProviderAdapter {
  readonly id = "openclaw" as const;
  readonly name = "OpenClaw";

  async isAvailable(): Promise<boolean> {
    if (!(await commandExists("docker"))) return false;

    // Check if the Docker image is pulled
    try {
      const proc = Bun.spawn(
        ["docker", "inspect", "openclaw/openclaw:latest"],
        { stdout: "pipe", stderr: "pipe" },
      );
      await proc.exited;
      return proc.exitCode === 0;
    } catch {
      return false;
    }
  }

  getInstallInstructions(): string {
    return "docker pull openclaw/openclaw:latest";
  }

  getSpawnCommand(options: SpawnOptions, _apiKey?: string): SpawnConfig {
    const containerName = options.sessionId
      ? `cm-openclaw-${options.sessionId.slice(0, 8)}`
      : `cm-openclaw-${Date.now()}`;

    const args = [
      "run",
      "-it",
      "--rm",
      `--name=${containerName}`,
      "--cpus=2",
      "--memory=2g",
      "--pids-limit=256",
      "--read-only",
      "--tmpfs", "/tmp:rw,noexec,nosuid,size=512m",
      "-v", `${options.workDir}:/workspace`,
      "-w", "/workspace",
      "--network=openclaw-net",
      "openclaw/openclaw:latest",
    ];

    // Extra args go after the image name
    if (options.args) args.push(...options.args);

    return {
      command: "docker",
      args,
      env: {},
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

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
    const args = [
      "run",
      "-it",
      "--rm",
      "--cpus=2",
      "--memory=2g",
      "-v",
      `${options.workDir}:/workspace`,
      "openclaw/openclaw:latest",
    ];
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

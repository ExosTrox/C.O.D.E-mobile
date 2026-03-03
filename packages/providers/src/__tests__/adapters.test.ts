import { describe, test, expect, mock, afterEach } from "bun:test";
import { ClaudeCodeAdapter } from "../adapters/claude-code.js";
import { OpenAICodexAdapter } from "../adapters/openai-codex.js";
import { GeminiCLIAdapter } from "../adapters/gemini-cli.js";
import { DeepSeekAdapter } from "../adapters/deepseek.js";
import { OpenClawAdapter } from "../adapters/openclaw.js";
import { ProviderRegistry, createDefaultRegistry } from "../registry.js";
import type { SpawnOptions } from "../types.js";

// ── Helpers ────────────────────────────────────────────────

const defaultOptions: SpawnOptions = {
  model: "test-model",
  workDir: "/tmp/test-project",
};

// ── Mock Bun.spawn for isAvailable tests ──────────────────

const originalSpawn = Bun.spawn;

function mockSpawn(exitCode: number) {
  // @ts-expect-error -- overriding Bun.spawn for testing
  Bun.spawn = mock((): { exited: Promise<number>; exitCode: number; stdout: string; stderr: string } => ({
    exited: Promise.resolve(exitCode),
    exitCode,
    stdout: "",
    stderr: "",
  }));
}

function restoreSpawn() {
  Bun.spawn = originalSpawn;
}

// ═══════════════════════════════════════════════════════════
//  Claude Code Adapter
// ═══════════════════════════════════════════════════════════

describe("ClaudeCodeAdapter", () => {
  const adapter = new ClaudeCodeAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("claude-code");
    expect(adapter.name).toBe("Claude Code");
  });

  test("getInstallInstructions returns npm command", () => {
    expect(adapter.getInstallInstructions()).toBe("npm install -g @anthropic-ai/claude-code");
  });

  // ── getSpawnCommand ──────────────────────────────────────

  describe("getSpawnCommand", () => {
    test("returns correct base command", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.command).toBe("claude");
      expect(config.args).toContain("--dangerously-skip-permissions");
      expect(config.cwd).toBe("/tmp/test-project");
    });

    test("injects API key into env", () => {
      const config = adapter.getSpawnCommand(defaultOptions, "sk-test-key");
      expect(config.env.ANTHROPIC_API_KEY).toBe("sk-test-key");
    });

    test("omits API key when not provided", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.env.ANTHROPIC_API_KEY).toBeUndefined();
    });

    test("sets CLAUDE_MODEL env", () => {
      const config = adapter.getSpawnCommand({ model: "claude-opus-4-6", workDir: "/tmp" });
      expect(config.env.CLAUDE_MODEL).toBe("claude-opus-4-6");
    });

    test("passes extra args after base args", () => {
      const config = adapter.getSpawnCommand({ ...defaultOptions, args: ["--verbose"] });
      expect(config.args).toContain("--verbose");
      expect(config.args).toContain("--dangerously-skip-permissions");
      // --dangerously-skip-permissions should come before extra args
      const skipIdx = config.args.indexOf("--dangerously-skip-permissions");
      const verboseIdx = config.args.indexOf("--verbose");
      expect(skipIdx).toBeLessThan(verboseIdx);
    });

    test("adds resume flags when conversationId is provided", () => {
      const config = adapter.getSpawnCommand({
        ...defaultOptions,
        conversationId: "conv-123",
      });
      expect(config.args).toContain("--resume");
      expect(config.args).toContain("--conversation-id");
      expect(config.args).toContain("conv-123");
    });

    test("omits resume flags when conversationId is absent", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.args).not.toContain("--resume");
      expect(config.args).not.toContain("--conversation-id");
    });
  });

  // ── parseAnalytics ────────────────────────────────────────

  describe("parseAnalytics", () => {
    test("returns null for non-analytics output", () => {
      expect(adapter.parseAnalytics("some random output")).toBeNull();
      expect(adapter.parseAnalytics("")).toBeNull();
    });

    test("parses cost line", () => {
      const result = adapter.parseAnalytics("Total cost: $0.1234");
      expect(result).not.toBeNull();
      expect(result?.estimatedCost).toBe(0.1234);
      expect(result?.inputTokens).toBe(0);
      expect(result?.outputTokens).toBe(0);
    });

    test("parses token counts with commas", () => {
      const result = adapter.parseAnalytics(
        "Total input tokens: 1,234\nTotal output tokens: 567",
      );
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1234);
      expect(result?.outputTokens).toBe(567);
    });

    test("parses all fields together", () => {
      const result = adapter.parseAnalytics(
        "Total input tokens: 10,000\nTotal output tokens: 5,000\nTotal cost: $0.50",
      );
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(10000);
      expect(result?.outputTokens).toBe(5000);
      expect(result?.estimatedCost).toBe(0.5);
    });
  });

  // ── isAvailable ──────────────────────────────────────────

  describe("isAvailable", () => {
    afterEach(() => restoreSpawn());

    test("returns true when claude CLI is found", async () => {
      mockSpawn(0);
      expect(await adapter.isAvailable()).toBe(true);
    });

    test("returns false when claude CLI is not found", async () => {
      mockSpawn(1);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  OpenAI Codex Adapter
// ═══════════════════════════════════════════════════════════

describe("OpenAICodexAdapter", () => {
  const adapter = new OpenAICodexAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("openai-codex");
    expect(adapter.name).toBe("OpenAI Codex CLI");
  });

  test("getInstallInstructions returns npm command", () => {
    expect(adapter.getInstallInstructions()).toBe("npm install -g @openai/codex");
  });

  // ── getSpawnCommand ──────────────────────────────────────

  describe("getSpawnCommand", () => {
    test("returns codex command with model, full-auto, and quiet", () => {
      const config = adapter.getSpawnCommand({ model: "gpt-4.1", workDir: "/tmp" });
      expect(config.command).toBe("codex");
      expect(config.args).toContain("--model");
      expect(config.args).toContain("gpt-4.1");
      expect(config.args).toContain("--full-auto");
      expect(config.args).toContain("--quiet");
      expect(config.cwd).toBe("/tmp");
    });

    test("model arg comes right after --model", () => {
      const config = adapter.getSpawnCommand({ model: "o3", workDir: "/tmp" });
      const modelIdx = config.args.indexOf("--model");
      expect(config.args[modelIdx + 1]).toBe("o3");
    });

    test("injects OPENAI_API_KEY", () => {
      const config = adapter.getSpawnCommand(defaultOptions, "sk-openai-key");
      expect(config.env.OPENAI_API_KEY).toBe("sk-openai-key");
    });

    test("omits API key when not provided", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.env.OPENAI_API_KEY).toBeUndefined();
    });

    test("appends extra args after base args", () => {
      const config = adapter.getSpawnCommand({ ...defaultOptions, args: ["--debug"] });
      expect(config.args).toContain("--debug");
      const quietIdx = config.args.indexOf("--quiet");
      const debugIdx = config.args.indexOf("--debug");
      expect(quietIdx).toBeLessThan(debugIdx);
    });

    test("works with all supported models", () => {
      for (const model of ["gpt-4.1", "o3", "o4-mini", "o3-mini"]) {
        const config = adapter.getSpawnCommand({ model, workDir: "/tmp" });
        expect(config.args).toContain(model);
      }
    });
  });

  // ── parseAnalytics ────────────────────────────────────────

  describe("parseAnalytics", () => {
    test("parses token line", () => {
      const result = adapter.parseAnalytics("Tokens: 1,234 input, 567 output");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1234);
      expect(result?.outputTokens).toBe(567);
    });

    test("parses cost line", () => {
      const result = adapter.parseAnalytics("Cost: $0.05");
      expect(result).not.toBeNull();
      expect(result?.estimatedCost).toBe(0.05);
    });

    test("parses tokens and cost together", () => {
      const result = adapter.parseAnalytics("Tokens: 2,000 input, 800 output\nCost: $0.12");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(2000);
      expect(result?.outputTokens).toBe(800);
      expect(result?.estimatedCost).toBe(0.12);
    });

    test("returns null for non-matching output", () => {
      expect(adapter.parseAnalytics("hello world")).toBeNull();
      expect(adapter.parseAnalytics("")).toBeNull();
    });

    test("handles tokens without commas", () => {
      const result = adapter.parseAnalytics("Tokens: 500 input, 200 output");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(500);
      expect(result?.outputTokens).toBe(200);
    });
  });

  // ── isAvailable ──────────────────────────────────────────

  describe("isAvailable", () => {
    afterEach(() => restoreSpawn());

    test("returns true when codex CLI is found", async () => {
      mockSpawn(0);
      expect(await adapter.isAvailable()).toBe(true);
    });

    test("returns false when codex CLI is not found", async () => {
      mockSpawn(1);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  Gemini CLI Adapter
// ═══════════════════════════════════════════════════════════

describe("GeminiCLIAdapter", () => {
  const adapter = new GeminiCLIAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("gemini-cli");
    expect(adapter.name).toBe("Gemini CLI");
  });

  test("getInstallInstructions returns npm command", () => {
    expect(adapter.getInstallInstructions()).toContain("npm install");
  });

  // ── getSpawnCommand ──────────────────────────────────────

  describe("getSpawnCommand", () => {
    test("returns gemini command with -m model args", () => {
      const config = adapter.getSpawnCommand({ model: "gemini-2.5-pro", workDir: "/tmp" });
      expect(config.command).toBe("gemini");
      expect(config.args).toContain("-m");
      expect(config.args).toContain("gemini-2.5-pro");
      expect(config.cwd).toBe("/tmp");
    });

    test("model arg comes right after -m", () => {
      const config = adapter.getSpawnCommand({ model: "gemini-2.5-flash", workDir: "/tmp" });
      const mIdx = config.args.indexOf("-m");
      expect(config.args[mIdx + 1]).toBe("gemini-2.5-flash");
    });

    test("injects GOOGLE_API_KEY", () => {
      const config = adapter.getSpawnCommand(defaultOptions, "goog-key");
      expect(config.env.GOOGLE_API_KEY).toBe("goog-key");
    });

    test("omits API key when not provided", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.env.GOOGLE_API_KEY).toBeUndefined();
    });

    test("does not set GEMINI_MODEL env (uses args instead)", () => {
      const config = adapter.getSpawnCommand({ model: "gemini-2.5-pro", workDir: "/tmp" });
      expect(config.env.GEMINI_MODEL).toBeUndefined();
    });

    test("appends extra args after model args", () => {
      const config = adapter.getSpawnCommand({ ...defaultOptions, args: ["--sandbox"] });
      expect(config.args).toContain("--sandbox");
      const modelIdx = config.args.indexOf(defaultOptions.model);
      const sandboxIdx = config.args.indexOf("--sandbox");
      expect(modelIdx).toBeLessThan(sandboxIdx);
    });

    test("works with all supported models", () => {
      for (const model of ["gemini-2.5-pro", "gemini-2.5-flash"]) {
        const config = adapter.getSpawnCommand({ model, workDir: "/tmp" });
        expect(config.args).toContain(model);
      }
    });
  });

  // ── parseAnalytics ────────────────────────────────────────

  describe("parseAnalytics", () => {
    test("parses token usage line", () => {
      const result = adapter.parseAnalytics("Token usage: 1,234 input / 567 output");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1234);
      expect(result?.outputTokens).toBe(567);
    });

    test("parses estimated cost", () => {
      const result = adapter.parseAnalytics("Estimated cost: $0.0042");
      expect(result).not.toBeNull();
      expect(result?.estimatedCost).toBe(0.0042);
    });

    test("parses tokens and cost together", () => {
      const result = adapter.parseAnalytics(
        "Token usage: 5,000 input / 2,000 output\nEstimated cost: $0.08",
      );
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(5000);
      expect(result?.outputTokens).toBe(2000);
      expect(result?.estimatedCost).toBe(0.08);
    });

    test("returns null for non-matching output", () => {
      expect(adapter.parseAnalytics("some text")).toBeNull();
      expect(adapter.parseAnalytics("")).toBeNull();
    });

    test("handles tokens without commas", () => {
      const result = adapter.parseAnalytics("Token usage: 500 input / 200 output");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(500);
      expect(result?.outputTokens).toBe(200);
    });
  });

  // ── isAvailable ──────────────────────────────────────────

  describe("isAvailable", () => {
    afterEach(() => restoreSpawn());

    test("returns true when gemini CLI is found", async () => {
      mockSpawn(0);
      expect(await adapter.isAvailable()).toBe(true);
    });

    test("returns false when gemini CLI is not found", async () => {
      mockSpawn(1);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  DeepSeek Adapter
// ═══════════════════════════════════════════════════════════

describe("DeepSeekAdapter", () => {
  const adapter = new DeepSeekAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("deepseek");
    expect(adapter.name).toBe("DeepSeek");
  });

  test("getInstallInstructions returns pip command", () => {
    expect(adapter.getInstallInstructions()).toBe("pip install aider-chat");
  });

  // ── getSpawnCommand ──────────────────────────────────────

  describe("getSpawnCommand", () => {
    test("uses aider with deepseek/ prefix", () => {
      const config = adapter.getSpawnCommand({ model: "deepseek-chat", workDir: "/tmp" });
      expect(config.command).toBe("aider");
      expect(config.args).toContain("--model");
      expect(config.args).toContain("deepseek/deepseek-chat");
    });

    test("includes --no-auto-commits and --no-git flags", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.args).toContain("--no-auto-commits");
      expect(config.args).toContain("--no-git");
    });

    test("injects DEEPSEEK_API_KEY", () => {
      const config = adapter.getSpawnCommand(defaultOptions, "ds-key");
      expect(config.env.DEEPSEEK_API_KEY).toBe("ds-key");
    });

    test("omits API key when not provided", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.env.DEEPSEEK_API_KEY).toBeUndefined();
    });

    test("appends extra args", () => {
      const config = adapter.getSpawnCommand({ ...defaultOptions, args: ["--edit-format", "diff"] });
      expect(config.args).toContain("--edit-format");
      expect(config.args).toContain("diff");
    });

    test("works with all supported models", () => {
      for (const model of ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"]) {
        const config = adapter.getSpawnCommand({ model, workDir: "/tmp" });
        expect(config.args).toContain(`deepseek/${model}`);
      }
    });

    test("sets cwd from workDir", () => {
      const config = adapter.getSpawnCommand({ model: "deepseek-chat", workDir: "/home/user/code" });
      expect(config.cwd).toBe("/home/user/code");
    });
  });

  // ── parseAnalytics ────────────────────────────────────────

  describe("parseAnalytics", () => {
    test("parses aider k-suffixed token line", () => {
      const result = adapter.parseAnalytics(
        "Tokens: 1.2k sent, 0.5k received. Cost: $0.01",
      );
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1200);
      expect(result?.outputTokens).toBe(500);
      expect(result?.estimatedCost).toBe(0.01);
    });

    test("parses aider raw number token line", () => {
      const result = adapter.parseAnalytics(
        "Tokens: 1200 sent, 500 received. Cost: $0.02",
      );
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(1200);
      expect(result?.outputTokens).toBe(500);
      expect(result?.estimatedCost).toBe(0.02);
    });

    test("parses tokens without cost", () => {
      const result = adapter.parseAnalytics("Tokens: 3.5k sent, 1.0k received.");
      expect(result).not.toBeNull();
      expect(result?.inputTokens).toBe(3500);
      expect(result?.outputTokens).toBe(1000);
      expect(result?.estimatedCost).toBeUndefined();
    });

    test("returns null for non-matching output", () => {
      expect(adapter.parseAnalytics("some text")).toBeNull();
      expect(adapter.parseAnalytics("")).toBeNull();
    });
  });

  // ── isAvailable ──────────────────────────────────────────

  describe("isAvailable", () => {
    afterEach(() => restoreSpawn());

    test("returns true when aider CLI is found", async () => {
      mockSpawn(0);
      expect(await adapter.isAvailable()).toBe(true);
    });

    test("returns false when aider CLI is not found", async () => {
      mockSpawn(1);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  OpenClaw Adapter
// ═══════════════════════════════════════════════════════════

describe("OpenClawAdapter", () => {
  const adapter = new OpenClawAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("openclaw");
    expect(adapter.name).toBe("OpenClaw");
  });

  test("getInstallInstructions returns docker pull", () => {
    expect(adapter.getInstallInstructions()).toBe("docker pull openclaw/openclaw:latest");
  });

  // ── getSpawnCommand ──────────────────────────────────────

  describe("getSpawnCommand", () => {
    test("uses docker run with correct flags", () => {
      const config = adapter.getSpawnCommand({
        model: "openclaw-local",
        workDir: "/home/user/project",
      });
      expect(config.command).toBe("docker");
      expect(config.args).toContain("run");
      expect(config.args).toContain("-it");
      expect(config.args).toContain("--rm");
      expect(config.args).toContain("--cpus=2");
      expect(config.args).toContain("--memory=2g");
    });

    test("mounts workDir as /workspace volume", () => {
      const config = adapter.getSpawnCommand({
        model: "openclaw-local",
        workDir: "/home/user/project",
      });
      expect(config.args).toContain("-v");
      expect(config.args).toContain("/home/user/project:/workspace");
    });

    test("uses correct docker image", () => {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(config.args).toContain("openclaw/openclaw:latest");
    });

    test("ignores apiKey (empty env)", () => {
      const config = adapter.getSpawnCommand(defaultOptions, "some-key");
      expect(Object.keys(config.env)).toHaveLength(0);
    });

    test("appends extra args after image name", () => {
      const config = adapter.getSpawnCommand({ ...defaultOptions, args: ["--gpu"] });
      expect(config.args).toContain("--gpu");
      const imgIdx = config.args.indexOf("openclaw/openclaw:latest");
      const gpuIdx = config.args.indexOf("--gpu");
      expect(imgIdx).toBeLessThan(gpuIdx);
    });

    test("does not define parseAnalytics", () => {
      expect("parseAnalytics" in adapter).toBe(false);
    });
  });

  // ── isAvailable ──────────────────────────────────────────

  describe("isAvailable", () => {
    afterEach(() => restoreSpawn());

    test("returns false when docker is not found", async () => {
      mockSpawn(1);
      expect(await adapter.isAvailable()).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
//  Provider Registry
// ═══════════════════════════════════════════════════════════

describe("ProviderRegistry", () => {
  test("register and get adapter", () => {
    const registry = new ProviderRegistry();
    const adapter = new ClaudeCodeAdapter();
    registry.register(adapter);
    expect(registry.get("claude-code")).toBe(adapter);
  });

  test("get throws for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.get("claude-code")).toThrow("Unknown provider: claude-code");
  });

  test("has returns true for registered and false for unregistered", () => {
    const registry = new ProviderRegistry();
    registry.register(new ClaudeCodeAdapter());
    expect(registry.has("claude-code")).toBe(true);
    expect(registry.has("openai-codex")).toBe(false);
  });

  test("list returns all registered adapters", () => {
    const registry = new ProviderRegistry();
    registry.register(new ClaudeCodeAdapter());
    registry.register(new OpenAICodexAdapter());
    expect(registry.list()).toHaveLength(2);
  });

  test("list returns adapters in registration order", () => {
    const registry = new ProviderRegistry();
    registry.register(new OpenAICodexAdapter());
    registry.register(new ClaudeCodeAdapter());
    const ids = registry.list().map((a) => a.id);
    expect(ids).toEqual(["openai-codex", "claude-code"]);
  });
});

describe("createDefaultRegistry", () => {
  test("includes all 5 providers", () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toHaveLength(5);
    expect(registry.has("claude-code")).toBe(true);
    expect(registry.has("openai-codex")).toBe(true);
    expect(registry.has("gemini-cli")).toBe(true);
    expect(registry.has("deepseek")).toBe(true);
    expect(registry.has("openclaw")).toBe(true);
  });

  test("get returns correct adapter types", () => {
    const registry = createDefaultRegistry();
    expect(registry.get("claude-code")).toBeInstanceOf(ClaudeCodeAdapter);
    expect(registry.get("openai-codex")).toBeInstanceOf(OpenAICodexAdapter);
    expect(registry.get("gemini-cli")).toBeInstanceOf(GeminiCLIAdapter);
    expect(registry.get("deepseek")).toBeInstanceOf(DeepSeekAdapter);
    expect(registry.get("openclaw")).toBeInstanceOf(OpenClawAdapter);
  });

  test("checkAvailability returns map for all providers", async () => {
    const registry = createDefaultRegistry();
    const availability = await registry.checkAvailability();
    expect(availability.size).toBe(5);
    for (const [, available] of availability) {
      expect(typeof available).toBe("boolean");
    }
  });

  test("checkAllProviders returns status objects with install instructions", async () => {
    const registry = createDefaultRegistry();
    const statuses = await registry.checkAllProviders();
    expect(statuses).toHaveLength(5);
    for (const status of statuses) {
      expect(typeof status.id).toBe("string");
      expect(typeof status.name).toBe("string");
      expect(typeof status.available).toBe("boolean");
      expect(typeof status.installInstructions).toBe("string");
      expect(status.installInstructions.length).toBeGreaterThan(0);
    }
  });

  test("checkAllProviders includes all provider IDs", async () => {
    const registry = createDefaultRegistry();
    const statuses = await registry.checkAllProviders();
    const ids = statuses.map((s) => s.id);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("openai-codex");
    expect(ids).toContain("gemini-cli");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("openclaw");
  });
});

// ═══════════════════════════════════════════════════════════
//  Cross-adapter consistency checks
// ═══════════════════════════════════════════════════════════

describe("Cross-adapter consistency", () => {
  const adapters = [
    new ClaudeCodeAdapter(),
    new OpenAICodexAdapter(),
    new GeminiCLIAdapter(),
    new DeepSeekAdapter(),
    new OpenClawAdapter(),
  ];

  test("all adapters have unique IDs", () => {
    const ids = adapters.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all adapters have non-empty names", () => {
    for (const adapter of adapters) {
      expect(adapter.name.length).toBeGreaterThan(0);
    }
  });

  test("all adapters return non-empty install instructions", () => {
    for (const adapter of adapters) {
      expect(adapter.getInstallInstructions().length).toBeGreaterThan(0);
    }
  });

  test("all adapters return valid SpawnConfig from getSpawnCommand", () => {
    for (const adapter of adapters) {
      const config = adapter.getSpawnCommand(defaultOptions);
      expect(typeof config.command).toBe("string");
      expect(config.command.length).toBeGreaterThan(0);
      expect(Array.isArray(config.args)).toBe(true);
      expect(typeof config.env).toBe("object");
    }
  });

  test("all adapters set cwd from workDir", () => {
    for (const adapter of adapters) {
      const config = adapter.getSpawnCommand({ model: "m", workDir: "/test/dir" });
      expect(config.cwd).toBe("/test/dir");
    }
  });
});

import { describe, test, expect } from "bun:test";
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

// ── Claude Code ────────────────────────────────────────────

describe("ClaudeCodeAdapter", () => {
  const adapter = new ClaudeCodeAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("claude-code");
    expect(adapter.name).toBe("Claude Code");
  });

  test("getSpawnCommand returns correct command structure", () => {
    const config = adapter.getSpawnCommand(defaultOptions);
    expect(config.command).toBe("claude");
    expect(config.args).toContain("--dangerously-skip-permissions");
    expect(config.cwd).toBe("/tmp/test-project");
  });

  test("getSpawnCommand injects API key into env", () => {
    const config = adapter.getSpawnCommand(defaultOptions, "sk-test-key");
    expect(config.env.ANTHROPIC_API_KEY).toBe("sk-test-key");
  });

  test("getSpawnCommand sets CLAUDE_MODEL env", () => {
    const config = adapter.getSpawnCommand({
      model: "claude-opus-4-6",
      workDir: "/tmp",
    });
    expect(config.env.CLAUDE_MODEL).toBe("claude-opus-4-6");
  });

  test("getSpawnCommand passes extra args", () => {
    const config = adapter.getSpawnCommand({
      ...defaultOptions,
      args: ["--verbose"],
    });
    expect(config.args).toContain("--verbose");
    expect(config.args).toContain("--dangerously-skip-permissions");
  });

  test("getInstallInstructions returns npm command", () => {
    expect(adapter.getInstallInstructions()).toContain("npm install");
  });

  test("parseAnalytics returns null for non-analytics output", () => {
    expect(adapter.parseAnalytics("some random output")).toBeNull();
  });

  test("parseAnalytics parses cost line", () => {
    const result = adapter.parseAnalytics("Total cost: $0.1234");
    expect(result).not.toBeNull();
    expect(result?.estimatedCost).toBe(0.1234);
  });

  test("parseAnalytics parses token counts", () => {
    const result = adapter.parseAnalytics(
      "Total input tokens: 1,234\nTotal output tokens: 567",
    );
    expect(result).not.toBeNull();
    expect(result?.inputTokens).toBe(1234);
    expect(result?.outputTokens).toBe(567);
  });
});

// ── OpenAI Codex ───────────────────────────────────────────

describe("OpenAICodexAdapter", () => {
  const adapter = new OpenAICodexAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("openai-codex");
    expect(adapter.name).toBe("OpenAI Codex CLI");
  });

  test("getSpawnCommand returns correct command with model", () => {
    const config = adapter.getSpawnCommand({
      model: "gpt-5.3-codex",
      workDir: "/tmp",
    });
    expect(config.command).toBe("codex");
    expect(config.args).toContain("--model");
    expect(config.args).toContain("gpt-5.3-codex");
    expect(config.args).toContain("--full-auto");
  });

  test("getSpawnCommand injects API key into env", () => {
    const config = adapter.getSpawnCommand(defaultOptions, "sk-openai-key");
    expect(config.env.OPENAI_API_KEY).toBe("sk-openai-key");
  });

  test("parseAnalytics parses token line", () => {
    const result = adapter.parseAnalytics("Tokens: 1,234 input, 567 output");
    expect(result).not.toBeNull();
    expect(result?.inputTokens).toBe(1234);
    expect(result?.outputTokens).toBe(567);
  });

  test("parseAnalytics returns null for non-matching output", () => {
    expect(adapter.parseAnalytics("hello world")).toBeNull();
  });
});

// ── Gemini CLI ─────────────────────────────────────────────

describe("GeminiCLIAdapter", () => {
  const adapter = new GeminiCLIAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("gemini-cli");
    expect(adapter.name).toBe("Gemini CLI");
  });

  test("getSpawnCommand returns gemini command", () => {
    const config = adapter.getSpawnCommand(defaultOptions);
    expect(config.command).toBe("gemini");
    expect(config.cwd).toBe("/tmp/test-project");
  });

  test("getSpawnCommand injects GOOGLE_API_KEY", () => {
    const config = adapter.getSpawnCommand(defaultOptions, "goog-key");
    expect(config.env.GOOGLE_API_KEY).toBe("goog-key");
  });

  test("getSpawnCommand sets GEMINI_MODEL env", () => {
    const config = adapter.getSpawnCommand({
      model: "gemini-2.5-pro",
      workDir: "/tmp",
    });
    expect(config.env.GEMINI_MODEL).toBe("gemini-2.5-pro");
  });

  test("does not define parseAnalytics", () => {
    expect("parseAnalytics" in adapter).toBe(false);
  });
});

// ── DeepSeek ───────────────────────────────────────────────

describe("DeepSeekAdapter", () => {
  const adapter = new DeepSeekAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("deepseek");
    expect(adapter.name).toBe("DeepSeek");
  });

  test("getSpawnCommand uses aider with deepseek/ prefix", () => {
    const config = adapter.getSpawnCommand({
      model: "deepseek-chat",
      workDir: "/tmp",
    });
    expect(config.command).toBe("aider");
    expect(config.args).toContain("--model");
    expect(config.args).toContain("deepseek/deepseek-chat");
  });

  test("getSpawnCommand injects DEEPSEEK_API_KEY", () => {
    const config = adapter.getSpawnCommand(defaultOptions, "ds-key");
    expect(config.env.DEEPSEEK_API_KEY).toBe("ds-key");
  });

  test("getInstallInstructions returns pip command", () => {
    expect(adapter.getInstallInstructions()).toContain("pip install");
  });

  test("parseAnalytics parses aider token line", () => {
    const result = adapter.parseAnalytics(
      "Tokens: 1.2k sent, 0.5k received. Cost: $0.01",
    );
    expect(result).not.toBeNull();
    expect(result?.inputTokens).toBe(1200);
    expect(result?.outputTokens).toBe(500);
    expect(result?.estimatedCost).toBe(0.01);
  });

  test("parseAnalytics returns null for non-matching output", () => {
    expect(adapter.parseAnalytics("some text")).toBeNull();
  });
});

// ── OpenClaw ───────────────────────────────────────────────

describe("OpenClawAdapter", () => {
  const adapter = new OpenClawAdapter();

  test("has correct id and name", () => {
    expect(adapter.id).toBe("openclaw");
    expect(adapter.name).toBe("OpenClaw");
  });

  test("getSpawnCommand uses docker run with volume mount", () => {
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
    expect(config.args).toContain("-v");
    expect(config.args).toContain("/home/user/project:/workspace");
    expect(config.args).toContain("openclaw/openclaw:latest");
  });

  test("getSpawnCommand ignores apiKey", () => {
    const config = adapter.getSpawnCommand(defaultOptions);
    expect(Object.keys(config.env)).toHaveLength(0);
  });

  test("getInstallInstructions returns docker pull", () => {
    expect(adapter.getInstallInstructions()).toContain("docker pull");
  });

  test("does not define parseAnalytics", () => {
    expect("parseAnalytics" in adapter).toBe(false);
  });
});

// ── ProviderRegistry ───────────────────────────────────────

describe("ProviderRegistry", () => {
  test("register and get adapter", () => {
    const registry = new ProviderRegistry();
    const adapter = new ClaudeCodeAdapter();
    registry.register(adapter);
    expect(registry.get("claude-code")).toBe(adapter);
  });

  test("get returns undefined for unknown provider", () => {
    const registry = new ProviderRegistry();
    expect(registry.get("claude-code")).toBeUndefined();
  });

  test("list returns all registered adapters", () => {
    const registry = new ProviderRegistry();
    registry.register(new ClaudeCodeAdapter());
    registry.register(new OpenAICodexAdapter());
    expect(registry.list()).toHaveLength(2);
  });

  test("createDefaultRegistry includes all 5 providers", () => {
    const registry = createDefaultRegistry();
    expect(registry.list()).toHaveLength(5);
    expect(registry.get("claude-code")).toBeDefined();
    expect(registry.get("openai-codex")).toBeDefined();
    expect(registry.get("gemini-cli")).toBeDefined();
    expect(registry.get("deepseek")).toBeDefined();
    expect(registry.get("openclaw")).toBeDefined();
  });

  test("checkAvailability returns map for all providers", async () => {
    const registry = createDefaultRegistry();
    const availability = await registry.checkAvailability();
    expect(availability.size).toBe(5);
    // Each value should be a boolean
    for (const [, available] of availability) {
      expect(typeof available).toBe("boolean");
    }
  });
});

import type { ProviderId, ProviderConfig } from "./types/provider.js";

export const API_VERSION = "v1";
export const DEFAULT_PORT = 3000;
export const WS_PING_INTERVAL = 30_000;
export const SESSION_OUTPUT_BUFFER_MS = 16; // ~60fps debounce
export const MAX_SCROLLBACK_LINES = 1000;

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "claude-code",
    displayName: "Claude Code",
    icon: "anthropic",
    models: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        contextWindow: 200_000,
        maxOutput: 16_000,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        contextWindow: 200_000,
        maxOutput: 32_000,
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
      },
      {
        id: "claude-haiku-3-5-20241022",
        name: "Claude 3.5 Haiku",
        contextWindow: 200_000,
        maxOutput: 8_192,
        costPer1kInput: 0.0008,
        costPer1kOutput: 0.004,
      },
    ],
    defaultModel: "claude-sonnet-4-20250514",
    requiresApiKey: false,
    installCommand: "npm install -g @anthropic-ai/claude-code",
    checkCommand: "claude --version",
  },
  "openai-codex": {
    id: "openai-codex",
    name: "openai-codex",
    displayName: "OpenAI Codex CLI",
    icon: "openai",
    models: [
      {
        id: "o4-mini",
        name: "o4-mini",
        contextWindow: 200_000,
        maxOutput: 100_000,
        costPer1kInput: 0.0011,
        costPer1kOutput: 0.0044,
      },
      {
        id: "o3",
        name: "o3",
        contextWindow: 200_000,
        maxOutput: 100_000,
        costPer1kInput: 0.01,
        costPer1kOutput: 0.04,
      },
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        contextWindow: 1_000_000,
        maxOutput: 32_000,
        costPer1kInput: 0.002,
        costPer1kOutput: 0.008,
      },
    ],
    defaultModel: "o4-mini",
    requiresApiKey: true,
    installCommand: "npm install -g @openai/codex",
    checkCommand: "codex --version",
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "gemini-cli",
    displayName: "Gemini CLI",
    icon: "google",
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        contextWindow: 1_000_000,
        maxOutput: 65_536,
        costPer1kInput: 0.00125,
        costPer1kOutput: 0.01,
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        contextWindow: 1_000_000,
        maxOutput: 65_536,
        costPer1kInput: 0.00015,
        costPer1kOutput: 0.0006,
      },
    ],
    defaultModel: "gemini-2.5-pro",
    requiresApiKey: true,
    installCommand: "npm install -g @anthropic-ai/gemini-cli",
    checkCommand: "gemini --version",
  },
  deepseek: {
    id: "deepseek",
    name: "deepseek",
    displayName: "DeepSeek Coder",
    icon: "deepseek",
    models: [
      {
        id: "deepseek-coder",
        name: "DeepSeek Coder V2",
        contextWindow: 128_000,
        maxOutput: 8_192,
        costPer1kInput: 0.00014,
        costPer1kOutput: 0.00028,
      },
      {
        id: "deepseek-chat",
        name: "DeepSeek Chat V3",
        contextWindow: 64_000,
        maxOutput: 8_192,
        costPer1kInput: 0.00027,
        costPer1kOutput: 0.0011,
      },
    ],
    defaultModel: "deepseek-coder",
    requiresApiKey: true,
    installCommand: "pip install deepseek-coder",
    checkCommand: "deepseek --version",
  },
  openclaw: {
    id: "openclaw",
    name: "openclaw",
    displayName: "OpenClaw",
    icon: "openclaw",
    models: [
      {
        id: "openclaw-local",
        name: "OpenClaw (Local Docker)",
        contextWindow: 32_000,
        maxOutput: 8_192,
        costPer1kInput: 0,
        costPer1kOutput: 0,
      },
    ],
    defaultModel: "openclaw-local",
    requiresApiKey: false,
    installCommand: "docker pull openclaw/openclaw:latest",
    checkCommand: "docker inspect openclaw/openclaw:latest",
  },
};

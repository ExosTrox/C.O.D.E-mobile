export type ProviderId =
  | "claude-code"
  | "openai-codex"
  | "gemini-cli"
  | "deepseek"
  | "openclaw";

export interface Model {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  displayName: string;
  icon: string;
  models: Model[];
  defaultModel: string;
  requiresApiKey: boolean;
  installCommand: string;
  checkCommand: string;
}

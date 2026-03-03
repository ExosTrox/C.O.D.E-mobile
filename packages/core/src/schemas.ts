import { z } from "zod";

// ────────────────────────────────────────────
// Provider Schemas
// ────────────────────────────────────────────

export const ProviderIdSchema = z.enum([
  "claude-code",
  "openai-codex",
  "gemini-cli",
  "deepseek",
  "openclaw",
]);
export type ProviderIdInferred = z.infer<typeof ProviderIdSchema>;

export const ModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextWindow: z.number().int().positive(),
  maxOutput: z.number().int().positive(),
  costPer1kInput: z.number().nonnegative(),
  costPer1kOutput: z.number().nonnegative(),
});
export type ModelInferred = z.infer<typeof ModelSchema>;

export const ProviderConfigSchema = z.object({
  id: ProviderIdSchema,
  name: z.string(),
  displayName: z.string(),
  icon: z.string(),
  models: z.array(ModelSchema).min(1),
  defaultModel: z.string(),
  requiresApiKey: z.boolean(),
  installCommand: z.string(),
  checkCommand: z.string(),
});
export type ProviderConfigInferred = z.infer<typeof ProviderConfigSchema>;

// ────────────────────────────────────────────
// Session Schemas
// ────────────────────────────────────────────

export const SessionIdSchema = z.string().brand<"SessionId">();
export type SessionIdInferred = z.infer<typeof SessionIdSchema>;

export const SessionStatusSchema = z.enum([
  "starting",
  "running",
  "stopped",
  "error",
  "suspended",
]);
export type SessionStatusInferred = z.infer<typeof SessionStatusSchema>;

export const SessionSchema = z.object({
  id: SessionIdSchema,
  name: z.string(),
  providerId: ProviderIdSchema,
  model: z.string(),
  status: SessionStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  pid: z.number().int().positive().nullable(),
  tmuxSessionName: z.string(),
  workDir: z.string(),
  conversationId: z.string().nullable(),
});
export type SessionInferred = z.infer<typeof SessionSchema>;

export const SessionCreateOptionsSchema = z.object({
  name: z.string().optional(),
  providerId: ProviderIdSchema,
  model: z.string().optional(),
  workDir: z.string().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  conversationId: z.string().optional(),
});
export type SessionCreateOptionsInferred = z.infer<
  typeof SessionCreateOptionsSchema
>;

export const SessionEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("output"),
    sessionId: SessionIdSchema,
    data: z.string(),
    offset: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("status_change"),
    sessionId: SessionIdSchema,
    from: SessionStatusSchema,
    to: SessionStatusSchema,
  }),
  z.object({
    type: z.literal("error"),
    sessionId: SessionIdSchema,
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal("permission_request"),
    sessionId: SessionIdSchema,
    requestId: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("notification"),
    sessionId: SessionIdSchema,
    title: z.string(),
    body: z.string(),
  }),
]);
export type SessionEventInferred = z.infer<typeof SessionEventSchema>;

// ────────────────────────────────────────────
// API Schemas
// ────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export function apiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: dataSchema }),
    z.object({ success: z.literal(false), error: ApiErrorSchema }),
  ]);
}

// --- Client → Server WebSocket Messages ---

export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    sessionId: SessionIdSchema,
  }),
  z.object({
    type: z.literal("unsubscribe"),
    sessionId: SessionIdSchema,
  }),
  z.object({
    type: z.literal("input"),
    sessionId: SessionIdSchema,
    text: z.string(),
  }),
  z.object({
    type: z.literal("resize"),
    sessionId: SessionIdSchema,
    cols: z.number().int().positive(),
    rows: z.number().int().positive(),
  }),
  z.object({
    type: z.literal("ping"),
  }),
]);
export type ClientMessageInferred = z.infer<typeof ClientMessageSchema>;

// --- Server → Client WebSocket Messages ---

export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("output"),
    sessionId: SessionIdSchema,
    data: z.string(),
    offset: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("status"),
    sessionId: SessionIdSchema,
    status: SessionStatusSchema,
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
    code: z.string().optional(),
  }),
  z.object({
    type: z.literal("permission_request"),
    sessionId: SessionIdSchema,
    requestId: z.string(),
    description: z.string(),
  }),
  z.object({
    type: z.literal("pong"),
    timestamp: z.number(),
  }),
]);
export type ServerMessageInferred = z.infer<typeof ServerMessageSchema>;

// ────────────────────────────────────────────
// Auth Schemas
// ────────────────────────────────────────────

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  createdAt: z.date(),
  totpEnabled: z.boolean(),
});
export type UserInferred = z.infer<typeof UserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type AuthTokensInferred = z.infer<typeof AuthTokensSchema>;

export const LoginRequestSchema = z.object({
  password: z.string().min(1),
  totpCode: z.string().length(6).optional(),
  deviceName: z.string().min(1),
});
export type LoginRequestInferred = z.infer<typeof LoginRequestSchema>;

/**
 * @code-mobile/core
 * Shared types, utilities, and constants for CODE Mobile.
 */

// Types
export type {
  ProviderId,
  Model,
  ProviderConfig,
} from "./types/provider.js";

export type {
  SessionId,
  SessionStatus,
  Session,
  SessionCreateOptions,
  SessionEvent,
} from "./types/session.js";

export type { ApiResponse, ClientMessage, ServerMessage } from "./types/api.js";

export type { User, AuthTokens, LoginRequest } from "./types/auth.js";

// Constants
export {
  API_VERSION,
  DEFAULT_PORT,
  WS_PING_INTERVAL,
  SESSION_OUTPUT_BUFFER_MS,
  MAX_SCROLLBACK_LINES,
  PROVIDERS,
} from "./constants.js";

// Schemas
export {
  ProviderIdSchema,
  ModelSchema,
  ProviderConfigSchema,
  SessionIdSchema,
  SessionStatusSchema,
  SessionSchema,
  SessionCreateOptionsSchema,
  SessionEventSchema,
  ApiErrorSchema,
  apiResponseSchema,
  ClientMessageSchema,
  ServerMessageSchema,
  UserSchema,
  AuthTokensSchema,
  LoginRequestSchema,
} from "./schemas.js";

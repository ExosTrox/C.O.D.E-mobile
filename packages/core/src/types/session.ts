import type { ProviderId } from "./provider.js";

export type SessionId = string & { __brand: "SessionId" };

export type SessionStatus =
  | "starting"
  | "running"
  | "stopped"
  | "error"
  | "suspended";

export interface Session {
  id: SessionId;
  name: string;
  providerId: ProviderId;
  model: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  pid: number | null;
  tmuxSessionName: string;
  workDir: string;
  conversationId: string | null;
}

export interface SessionCreateOptions {
  name?: string;
  providerId: ProviderId;
  model?: string;
  workDir?: string;
  envVars?: Record<string, string>;
  /** Conversation ID for session resume (Claude Code --resume). */
  conversationId?: string;
}

export type SessionEvent =
  | { type: "output"; sessionId: SessionId; data: string; offset: number }
  | {
      type: "status_change";
      sessionId: SessionId;
      from: SessionStatus;
      to: SessionStatus;
    }
  | { type: "error"; sessionId: SessionId; message: string; code?: string }
  | {
      type: "permission_request";
      sessionId: SessionId;
      requestId: string;
      description: string;
    }
  | {
      type: "notification";
      sessionId: SessionId;
      title: string;
      body: string;
    };

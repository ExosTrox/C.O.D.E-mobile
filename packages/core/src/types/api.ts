import type { SessionId, SessionStatus } from "./session.js";

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// --- Client → Server WebSocket Messages ---

export type ClientMessage =
  | { type: "subscribe"; sessionId: SessionId }
  | { type: "unsubscribe"; sessionId: SessionId }
  | { type: "input"; sessionId: SessionId; text: string }
  | { type: "resize"; sessionId: SessionId; cols: number; rows: number }
  | { type: "ping" };

// --- Server → Client WebSocket Messages ---

export type ServerMessage =
  | {
      type: "output";
      sessionId: SessionId;
      data: string;
      offset: number;
    }
  | {
      type: "status";
      sessionId: SessionId;
      status: SessionStatus;
    }
  | { type: "error"; message: string; code?: string }
  | {
      type: "permission_request";
      sessionId: SessionId;
      requestId: string;
      description: string;
    }
  | { type: "pong"; timestamp: number };

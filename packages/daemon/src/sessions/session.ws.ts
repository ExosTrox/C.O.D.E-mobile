// ── Session WebSocket Handler ───────────────────────────────
// Real-time terminal output streaming over WebSocket.

import type { Hono } from "hono";
import { upgradeWebSocket } from "hono/bun";
import type { WSContext } from "hono/ws";
import { WS_PING_INTERVAL } from "@code-mobile/core";
import type { SessionId, ServerMessage } from "@code-mobile/core";
import type { AuthService, DecodedToken } from "../auth/auth.service.js";
import type { SessionManager } from "./session.manager.js";
import type { StreamChunk } from "./session.streamer.js";

// ── Per-connection state ────────────────────────────────────

interface WsClient {
  ws: WSContext;
  user: DecodedToken | null;
  subscriptions: Map<string, (chunk: StreamChunk) => void>;
  lastActivity: number;
  alive: boolean;
}

// Track all active clients for keepalive checks
const clients = new Set<WsClient>();
let keepaliveTimer: ReturnType<typeof setInterval> | null = null;

// ── Setup ───────────────────────────────────────────────────

interface WsEnv {
  Variables: {
    requestId: string;
    user: DecodedToken;
  };
}

export function setupSessionWebSocket(
  app: Hono<WsEnv>,
  authService: AuthService,
  sessionManager: SessionManager,
): void {
  // Start global keepalive checker
  startKeepalive();

  app.get(
    "/api/v1/ws",
    // Auth middleware: verify JWT from ?token= query param
    async (c, next) => {
      const token = c.req.query("token");
      if (!token) {
        return c.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "token query param required" } },
          401,
        );
      }
      try {
        const user = await authService.verifyAccessToken(token);
        c.set("user", user);
        return next();
      } catch {
        return c.json(
          { success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } },
          401,
        );
      }
    },

    // WebSocket upgrade
    upgradeWebSocket((c) => {
      const user = c.get("user") as DecodedToken;
      const client: WsClient = {
        ws: null as unknown as WSContext, // set in onOpen
        user,
        subscriptions: new Map(),
        lastActivity: Date.now(),
        alive: true,
      };

      return {
        onOpen(_event, ws) {
          client.ws = ws;
          clients.add(client);

          // Send connected message
          send(ws, {
            type: "connected" as "pong", // cast for TS — we extend the protocol
            sessionCount: sessionManager.listSessions("running").length,
          } as unknown as ServerMessage);
        },

        onMessage(event, ws) {
          client.lastActivity = Date.now();
          client.alive = true;

          try {
            const msg = JSON.parse(String(event.data));
            handleClientMessage(client, ws, msg, sessionManager);
          } catch {
            send(ws, { type: "error", message: "Invalid JSON" });
          }
        },

        onClose() {
          // Unsubscribe from all sessions
          for (const [sessionId, listener] of client.subscriptions) {
            const streamer = sessionManager.getStreamer(sessionId);
            if (streamer) {
              streamer.removeListener("data", listener);
            }
          }
          client.subscriptions.clear();
          clients.delete(client);
        },

        onError() {
          clients.delete(client);
        },
      };
    }),
  );
}

// ── Message handling ────────────────────────────────────────

function handleClientMessage(
  client: WsClient,
  ws: WSContext,
  msg: Record<string, unknown>,
  sessionManager: SessionManager,
): void {
  // Ownership check for session-scoped messages
  const sessionId = msg.sessionId as string | undefined;
  if (sessionId && client.user) {
    if (!sessionManager.isSessionOwner(sessionId, client.user.sub)) {
      send(ws, { type: "error", message: "Session not found or access denied" });
      return;
    }
  }

  switch (msg.type) {
    case "subscribe":
      handleSubscribe(client, ws, msg.sessionId as string, sessionManager, msg.offset as number | undefined);
      break;

    case "unsubscribe":
      handleUnsubscribe(client, msg.sessionId as string, sessionManager);
      break;

    case "input":
      void sessionManager.sendInput(msg.sessionId as string, msg.text as string).catch((err: unknown) => {
        send(ws, { type: "error", message: err instanceof Error ? err.message : "Input failed" });
      });
      break;

    case "keys":
      void sessionManager.sendKeys(msg.sessionId as string, msg.keys as string).catch((err: unknown) => {
        send(ws, { type: "error", message: err instanceof Error ? err.message : "Keys failed" });
      });
      break;

    case "resize":
      void sessionManager
        .resizeTerminal(msg.sessionId as string, msg.cols as number, msg.rows as number)
        .catch((err: unknown) => {
          send(ws, { type: "error", message: err instanceof Error ? err.message : "Resize failed" });
        });
      break;

    case "ping":
      send(ws, { type: "pong", timestamp: Date.now() });
      break;

    default:
      send(ws, { type: "error", message: `Unknown message type: ${String(msg.type)}` });
  }
}

// ── Subscribe / Unsubscribe ─────────────────────────────────

function handleSubscribe(
  client: WsClient,
  ws: WSContext,
  sessionId: string,
  sessionManager: SessionManager,
  fromOffset?: number,
  retryCount = 0,
): void {
  // Already subscribed?
  if (client.subscriptions.has(sessionId)) return;

  const streamer = sessionManager.getStreamer(sessionId);
  if (!streamer) {
    // Streamer may not be ready yet (race between session creation and subscribe).
    // Retry up to 5 times with increasing delay.
    if (retryCount < 5) {
      const delay = 1000 * (retryCount + 1); // 1s, 2s, 3s, 4s, 5s
      console.log(`[WS] Streamer not ready for ${sessionId}, retry ${retryCount + 1}/5 in ${delay}ms`);
      setTimeout(() => {
        if (clients.has(client)) { // Only if client is still connected
          handleSubscribe(client, ws, sessionId, sessionManager, fromOffset, retryCount + 1);
        }
      }, delay);
      return;
    }
    send(ws, { type: "error", message: `Session not found or not active: ${sessionId}` });
    return;
  }

  // Create listener for new output
  const listener = (chunk: StreamChunk) => {
    const data = Buffer.from(chunk.bytes).toString("base64");
    send(ws, {
      type: "output",
      sessionId: sessionId as SessionId,
      data,
      offset: chunk.offset,
    });
  };

  // Mark subscription immediately to prevent duplicate subscribes
  client.subscriptions.set(sessionId, listener);

  // Send history FIRST, then attach live listener to avoid out-of-order data
  const offset = fromOffset ?? 0;
  void streamer.getHistory(offset).then((history) => {
    if (history.bytes.length > 0) {
      const data = Buffer.from(history.bytes).toString("base64");
      send(ws, {
        type: "output",
        sessionId: sessionId as SessionId,
        data,
        offset: history.offset,
      });
    }
    // Now attach live listener — after history is sent
    streamer.on("data", listener);
  });
}

function handleUnsubscribe(
  client: WsClient,
  sessionId: string,
  sessionManager: SessionManager,
): void {
  const listener = client.subscriptions.get(sessionId);
  if (!listener) return;

  const streamer = sessionManager.getStreamer(sessionId);
  if (streamer) {
    streamer.removeListener("data", listener);
  }
  client.subscriptions.delete(sessionId);
}

// ── Keepalive ───────────────────────────────────────────────

function startKeepalive(): void {
  if (keepaliveTimer) clearInterval(keepaliveTimer);

  keepaliveTimer = setInterval(() => {
    const now = Date.now();
    const timeout = WS_PING_INTERVAL + 10_000; // 30s + 10s grace

    for (const client of clients) {
      if (now - client.lastActivity > timeout) {
        // Client is unresponsive — disconnect
        try {
          client.ws.close(4000, "Connection timeout");
        } catch {
          // already closed
        }
        clients.delete(client);
      }
    }
  }, 10_000); // Check every 10 seconds
}

export function stopKeepalive(): void {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function send(ws: WSContext, msg: ServerMessage | Record<string, unknown>): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // Connection may have been closed
  }
}

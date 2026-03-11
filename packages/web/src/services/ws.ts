// ── WebSocket Client ────────────────────────────────────────

import type { ClientMessage, ServerMessage } from "@code-mobile/core";

type WsEventType = ServerMessage["type"] | "connected" | "disconnected" | "reconnecting";
type WsCallback = (data: never) => void;

const MAX_RECONNECT_DELAY = 30_000;
const VISIBILITY_DISCONNECT_DELAY = 5 * 60_000; // 5 minutes hidden → disconnect
const PING_INTERVAL = 25_000;

export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: ClientMessage[] = [];
  private listeners = new Map<string, Set<WsCallback>>();
  private token: string | null = null;
  private lastPingSent = 0;
  private _latencyMs = 0;
  private intentionalClose = false;

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get latencyMs(): number {
    return this._latencyMs;
  }

  // ── Connection ──────────────────────────────────────────

  connect(token: string): void {
    this.token = token;
    this.intentionalClose = false;
    // Remove old visibility handler before setting up new one
    this.removeVisibilityHandler();
    this.doConnect();
    this.setupVisibilityHandler();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.cleanupTimers();
    this.removeVisibilityHandler();

    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }

    this.emit("disconnected", undefined);
  }

  // ── Messaging ───────────────────────────────────────────

  send(message: ClientMessage): void {
    if (this.connected && this.ws) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Cap queue to prevent unbounded memory growth while disconnected
      if (this.messageQueue.length < 500) {
        this.messageQueue.push(message);
      }
    }
  }

  subscribe(sessionId: string, offset?: number): void {
    this.send({ type: "subscribe", sessionId: sessionId as never, offset });
  }

  unsubscribe(sessionId: string): void {
    this.send({ type: "unsubscribe", sessionId: sessionId as never });
  }

  sendInput(sessionId: string, text: string): void {
    this.send({ type: "input", sessionId: sessionId as never, text });
  }

  sendKeys(sessionId: string, keys: string): void {
    this.send({ type: "keys", sessionId: sessionId as never, keys });
  }

  sendResize(sessionId: string, cols: number, rows: number): void {
    this.send({ type: "resize", sessionId: sessionId as never, cols, rows });
  }

  ping(): void {
    this.lastPingSent = Date.now();
    this.send({ type: "ping" });
  }

  // ── Event listeners ─────────────────────────────────────

  on(eventType: WsEventType, callback: (data: never) => void): void {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    set.add(callback);
  }

  off(eventType: WsEventType, callback: (data: never) => void): void {
    this.listeners.get(eventType)?.delete(callback);
  }

  // ── Internals ───────────────────────────────────────────

  private emit(type: string, data: unknown): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data as never);
      } catch (err) {
        console.error(`[ws] listener error for "${type}":`, err);
      }
    }
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || !this.token) return;

    // Clean up previous connection
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const url = `${protocol}//${host}/api/v1/ws?token=${encodeURIComponent(this.token)}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.flushQueue();
      this.startPing();
      this.emit("connected", undefined);
    };

    this.ws.onclose = (event) => {
      this.stopPing();

      if (!this.intentionalClose) {
        this.emit("disconnected", { code: event.code, reason: event.reason });
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, reconnection handled there
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;

        // Track latency from pong responses
        if (msg.type === "pong" && this.lastPingSent > 0) {
          this._latencyMs = Date.now() - this.lastPingSent;
          this.lastPingSent = 0;
        }

        this.emit(msg.type, msg);
      } catch {
        console.error("[ws] failed to parse message:", event.data);
      }
    };
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.connected && this.ws) {
      const msg = this.messageQueue.shift();
      if (msg) {
        this.ws.send(JSON.stringify(msg));
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;

    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY,
    );
    this.reconnectAttempts++;

    this.emit("reconnecting", { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => this.ping(), PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanupTimers(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.visibilityTimer) {
      clearTimeout(this.visibilityTimer);
      this.visibilityTimer = null;
    }
  }

  // ── Visibility handling ─────────────────────────────────

  private handleVisibilityChange = () => {
    if (document.hidden) {
      // Schedule disconnect after 5min hidden
      this.visibilityTimer = setTimeout(() => {
        if (document.hidden && this.ws) {
          this.intentionalClose = true;
          this.ws.close(1000, "Hidden timeout");
          this.ws = null;
          this.intentionalClose = false; // Allow reconnect on visible
        }
      }, VISIBILITY_DISCONNECT_DELAY);
    } else {
      // Page visible again — cancel pending disconnect and reconnect if needed
      if (this.visibilityTimer) {
        clearTimeout(this.visibilityTimer);
        this.visibilityTimer = null;
      }
      if (!this.connected && this.token && !this.reconnectTimer) {
        this.doConnect();
      }
    }
  };

  private setupVisibilityHandler(): void {
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private removeVisibilityHandler(): void {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
  }
}

// ── Singleton ──────────────────────────────────────────────

export const wsClient = new WsClient();

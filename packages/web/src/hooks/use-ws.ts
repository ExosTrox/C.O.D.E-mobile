import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useAuthStore, getPersistedAuth } from "../stores/auth.store";
import { useConnectionStore } from "../stores/connection.store";

/**
 * Auto-connects the WebSocket when authenticated, disconnects on logout.
 * Bridges WsClient events into the connection store.
 */
export function useWs() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setStatus = useConnectionStore((s) => s.setStatus);
  const setLatency = useConnectionStore((s) => s.setLatency);

  // Bind WsClient events → connection store
  useEffect(() => {
    const onConnected = (() => setStatus("connected")) as never;
    const onDisconnected = (() => setStatus("disconnected")) as never;
    const onReconnecting = (() => setStatus("connecting")) as never;
    const onPong = (() => setLatency(wsClient.latencyMs)) as never;

    wsClient.on("connected", onConnected);
    wsClient.on("disconnected", onDisconnected);
    wsClient.on("reconnecting", onReconnecting);
    wsClient.on("pong", onPong);

    return () => {
      wsClient.off("connected", onConnected);
      wsClient.off("disconnected", onDisconnected);
      wsClient.off("reconnecting", onReconnecting);
      wsClient.off("pong", onPong);
    };
  }, [setStatus, setLatency]);

  useEffect(() => {
    // Use zustand token, fall back to localStorage (zustand may not have hydrated yet)
    const token = accessToken || getPersistedAuth().accessToken;
    if (token) {
      setStatus("connecting");
      wsClient.connect(token);
    } else {
      wsClient.disconnect();
      setStatus("disconnected");
    }

    return () => {
      // Don't disconnect on unmount — let visibility handler manage lifecycle
    };
  }, [accessToken, setStatus]);

  return wsClient;
}

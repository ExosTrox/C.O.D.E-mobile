import { useEffect, useRef } from "react";
import { wsClient } from "../services/ws";
import { useAuthStore } from "../stores/auth.store";
import { useConnectionStore } from "../stores/connection.store";

/**
 * Auto-connects the WebSocket when authenticated, disconnects on logout.
 * Bridges WsClient events into the connection store.
 */
export function useWs() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setStatus = useConnectionStore((s) => s.setStatus);
  const setLatency = useConnectionStore((s) => s.setLatency);
  const boundRef = useRef(false);

  useEffect(() => {
    // Bind WsClient events → connection store (once)
    if (!boundRef.current) {
      boundRef.current = true;

      wsClient.on("connected", (() => {
        setStatus("connected");
      }) as never);

      wsClient.on("disconnected", (() => {
        setStatus("disconnected");
      }) as never);

      wsClient.on("reconnecting", (() => {
        setStatus("connecting");
      }) as never);

      wsClient.on("pong", (() => {
        setLatency(wsClient.latencyMs);
      }) as never);
    }
  }, [setStatus, setLatency]);

  useEffect(() => {
    if (accessToken) {
      setStatus("connecting");
      wsClient.connect(accessToken);
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

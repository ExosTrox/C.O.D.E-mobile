// ── Connection Store ────────────────────────────────────────

import { create } from "zustand";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface ConnectionState {
  status: ConnectionStatus;
  latencyMs: number;
  lastConnected: Date | null;

  setStatus: (status: ConnectionStatus) => void;
  setLatency: (ms: number) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: "disconnected",
  latencyMs: 0,
  lastConnected: null,

  setStatus: (status) =>
    set((state) => ({
      status,
      lastConnected: status === "connected" ? new Date() : state.lastConnected,
    })),

  setLatency: (ms) => set({ latencyMs: ms }),
}));

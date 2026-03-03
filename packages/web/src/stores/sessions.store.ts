// ── Sessions Store ──────────────────────────────────────────

import { create } from "zustand";

interface TerminalSize {
  cols: number;
  rows: number;
}

interface SessionsState {
  activeSessionId: string | null;
  terminalSizes: Record<string, TerminalSize>;

  setActiveSession: (id: string | null) => void;
  setTerminalSize: (id: string, cols: number, rows: number) => void;
}

export const useSessionsStore = create<SessionsState>()((set) => ({
  activeSessionId: null,
  terminalSizes: {},

  setActiveSession: (id) => set({ activeSessionId: id }),

  setTerminalSize: (id, cols, rows) =>
    set((state) => ({
      terminalSizes: {
        ...state.terminalSizes,
        [id]: { cols, rows },
      },
    })),
}));

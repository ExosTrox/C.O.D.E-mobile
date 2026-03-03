// ── Terminal Settings Store ─────────────────────────────────
// Persisted to localStorage for terminal display preferences.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CursorStyle = "block" | "underline" | "bar";

export interface TerminalSettings {
  fontSize: number;
  theme: string;
  cursorStyle: CursorStyle;
  scrollbackLines: number;

  setFontSize: (size: number) => void;
  setTheme: (theme: string) => void;
  setCursorStyle: (style: CursorStyle) => void;
  setScrollbackLines: (lines: number) => void;
}

export const useTerminalStore = create<TerminalSettings>()(
  persist(
    (set) => ({
      fontSize: 14,
      theme: "tokyo-night",
      cursorStyle: "block",
      scrollbackLines: 5000,

      setFontSize: (fontSize) => set({ fontSize }),
      setTheme: (theme) => set({ theme }),
      setCursorStyle: (cursorStyle) => set({ cursorStyle }),
      setScrollbackLines: (scrollbackLines) => set({ scrollbackLines }),
    }),
    {
      name: "code-mobile-terminal",
    },
  ),
);

// ── Theme Hook ──────────────────────────────────────────────
// Syncs the terminal theme selection to the document's data-theme attribute
// and updates the meta theme-color for the PWA status bar.

import { useEffect } from "react";
import { useTerminalStore } from "../stores/terminal.store";

const THEME_META_COLORS: Record<string, string> = {
  "tokyo-night": "#0a0c10",
  catppuccin: "#11111b",
  dracula: "#1e1f29",
  nord: "#242933",
  "solarized-dark": "#001e26",
};

export function useThemeSync() {
  const theme = useTerminalStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_META_COLORS[theme] ?? "#0a0c10");
    }
  }, [theme]);
}

// ── XTerminal ───────────────────────────────────────────────
// Core terminal component — xterm.js with WebGL, WS streaming.

import { memo, useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { wsClient } from "../../services/ws";
import { useSessionsStore } from "../../stores/sessions.store";
import { useTerminalStore } from "../../stores/terminal.store";
import { cn } from "../../lib/cn";
import "@xterm/xterm/css/xterm.css";

// ── Terminal themes ────────────────────────────────────────

import type { ITheme } from "@xterm/xterm";

const THEMES: Record<string, ITheme> = {
  "tokyo-night": {
    background: "#1a1b26",
    foreground: "#a9b1d6",
    cursor: "#c0caf5",
    selectionBackground: "#33467c",
    black: "#15161e",
    red: "#f7768e",
    green: "#9ece6a",
    yellow: "#e0af68",
    blue: "#7aa2f7",
    magenta: "#bb9af7",
    cyan: "#7dcfff",
    white: "#a9b1d6",
    brightBlack: "#414868",
    brightRed: "#f7768e",
    brightGreen: "#9ece6a",
    brightYellow: "#e0af68",
    brightBlue: "#7aa2f7",
    brightMagenta: "#bb9af7",
    brightCyan: "#7dcfff",
    brightWhite: "#c0caf5",
  },
  catppuccin: {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    cursor: "#f5e0dc",
    selectionBackground: "#45475a",
    black: "#45475a",
    red: "#f38ba8",
    green: "#a6e3a1",
    yellow: "#f9e2af",
    blue: "#89b4fa",
    magenta: "#f5c2e7",
    cyan: "#94e2d5",
    white: "#bac2de",
    brightBlack: "#585b70",
    brightRed: "#f38ba8",
    brightGreen: "#a6e3a1",
    brightYellow: "#f9e2af",
    brightBlue: "#89b4fa",
    brightMagenta: "#f5c2e7",
    brightCyan: "#94e2d5",
    brightWhite: "#a6adc8",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    selectionBackground: "#44475a",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
  nord: {
    background: "#2e3440",
    foreground: "#d8dee9",
    cursor: "#d8dee9",
    selectionBackground: "#434c5e",
    black: "#3b4252",
    red: "#bf616a",
    green: "#a3be8c",
    yellow: "#ebcb8b",
    blue: "#81a1c1",
    magenta: "#b48ead",
    cyan: "#88c0d0",
    white: "#e5e9f0",
    brightBlack: "#4c566a",
    brightRed: "#bf616a",
    brightGreen: "#a3be8c",
    brightYellow: "#ebcb8b",
    brightBlue: "#81a1c1",
    brightMagenta: "#b48ead",
    brightCyan: "#8fbcbb",
    brightWhite: "#eceff4",
  },
  "solarized-dark": {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    selectionBackground: "#073642",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#586e75",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
};

// ── Props ──────────────────────────────────────────────────

interface XTerminalProps {
  sessionId: string;
  className?: string;
}

export const XTerminal = memo(function XTerminal({ sessionId, className }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastOffsetRef = useRef(0);
  const fitRafRef = useRef(0);
  const setTerminalSize = useSessionsStore((s) => s.setTerminalSize);
  const termTheme = useTerminalStore((s) => s.theme);
  const termFontSize = useTerminalStore((s) => s.fontSize);
  const termCursorStyle = useTerminalStore((s) => s.cursorStyle);
  const termScrollback = useTerminalStore((s) => s.scrollbackLines);

  // ── Debounced fit helper ──────────────────────────────────

  const doFit = useCallback(() => {
    // Cancel any pending fit
    if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);

    fitRafRef.current = requestAnimationFrame(() => {
      const fitAddon = fitAddonRef.current;
      if (!fitAddon) return;

      try {
        fitAddon.fit();
      } catch {
        return;
      }

      const term = terminalRef.current;
      if (term) {
        const { cols, rows } = term;
        setTerminalSize(sessionId, cols, rows);
        wsClient.sendResize(sessionId, cols, rows);
      }
    });
  }, [sessionId, setTerminalSize]);

  // ── Initialize terminal ───────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create terminal with user preferences
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: termCursorStyle,
      fontSize: termFontSize,
      fontFamily: "'JetBrains Mono', monospace",
      theme: THEMES[termTheme] ?? THEMES["tokyo-night"],
      scrollback: termScrollback,
      allowProposedApi: true,
      convertEol: true,
      drawBoldTextInBrightColors: true,
    });

    // Create addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    // Open terminal in container
    term.open(container);

    // Lazy-load WebGL addon for better performance
    void import("@xterm/addon-webgl").then(({ WebglAddon }) => {
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => webglAddon.dispose());
        term.loadAddon(webglAddon);
      } catch {
        // WebGL not available — canvas renderer is the default
      }
    });

    // Store refs
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Initial fit
    requestAnimationFrame(() => doFit());

    // ── WS subscribe & output handling ──────────────────────

    lastOffsetRef.current = 0;
    wsClient.subscribe(sessionId);

    const handleOutput = (msg: { sessionId: string; data: string; offset: number }) => {
      if (msg.sessionId !== sessionId) return;
      try {
        const bytes = atob(msg.data);
        term.write(bytes);
        lastOffsetRef.current = msg.offset + bytes.length;
      } catch {
        term.write(msg.data);
      }
    };

    const handleReconnect = () => {
      wsClient.subscribe(sessionId, lastOffsetRef.current);
    };

    wsClient.on("output", handleOutput as never);
    wsClient.on("connected", handleReconnect as never);

    // ── Input forwarding ────────────────────────────────────

    const dataDisposable = term.onData((data) => {
      wsClient.sendInput(sessionId, data);
    });

    // ── ResizeObserver (debounced via doFit) ─────────────────

    const resizeObserver = new ResizeObserver(() => doFit());
    resizeObserver.observe(container);

    // ── Cleanup ─────────────────────────────────────────────

    return () => {
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      wsClient.off("output", handleOutput as never);
      wsClient.off("connected", handleReconnect as never);
      wsClient.unsubscribe(sessionId);
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, doFit, termTheme, termFontSize, termCursorStyle, termScrollback]);

  // ── Focus terminal on click ───────────────────────────────

  const handleClick = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full bg-terminal-bg", className)}
      onClick={handleClick}
    />
  );
});

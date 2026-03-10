// ── XTerminal ───────────────────────────────────────────────
// Core terminal component — xterm.js with WebGL, WS streaming.

import { memo, useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { wsClient } from "../../services/ws";
import { apiClient } from "../../services/api";
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

// ── Component ──────────────────────────────────────────────

export const XTerminal = memo(function XTerminal({ sessionId, className }: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const fitRafRef = useRef<number | null>(null);
  const lastOffsetRef = useRef(0);
  const webglAddonRef = useRef<InstanceType<typeof import("@xterm/addon-webgl").WebglAddon> | null>(null);

  const setTerminalSize = useSessionsStore((s) => s.setTerminalSize);

  // Read store values
  const termTheme = useTerminalStore((s) => s.theme);
  const termFontSize = useTerminalStore((s) => s.fontSize);
  const termCursorStyle = useTerminalStore((s) => s.cursorStyle);
  const termScrollback = useTerminalStore((s) => s.scrollbackLines);

  // ── Debounced fit ─────────────────────────────────────────

  const doFit = useCallback(() => {
    if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      const fit = fitAddonRef.current;
      const term = terminalRef.current;
      if (!fit || !term) return;
      try {
        fit.fit();
        const { cols, rows } = term;
        setTerminalSize(sessionId, cols, rows);
        wsClient.sendResize(sessionId, cols, rows);
      } catch {
        // ignore
      }
    });
  }, [sessionId, setTerminalSize]);

  // ── Initialize terminal (only on sessionId change) ────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;

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
      // Mobile: increase scroll sensitivity for touch, allow smooth scrolling
      scrollSensitivity: isMobile ? 3 : 1,
      fastScrollSensitivity: isMobile ? 10 : 5,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(container);

    // Lazy-load WebGL addon (skip on mobile — causes touch/performance issues on iOS)
    if (!isMobile) {
      void import("@xterm/addon-webgl").then(({ WebglAddon }) => {
        if (!terminalRef.current) return; // disposed
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
            webglAddonRef.current = null;
          });
          term.loadAddon(webglAddon);
          webglAddonRef.current = webglAddon;
        } catch {
          // WebGL not available
        }
      });
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    requestAnimationFrame(() => doFit());

    // ── WS subscribe & output handling ──────────────────────

    lastOffsetRef.current = 0;
    let subscribed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let httpPollTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    // Subscribe with retry — streamer may not be ready immediately after session creation
    const trySubscribe = (offset?: number) => {
      if (subscribed || disposed) return;
      wsClient.subscribe(sessionId, offset);
    };

    // HTTP fallback: fetch output via REST API if WS isn't delivering
    const fetchOutputViaHttp = async () => {
      if (disposed) return;
      try {
        const result = await apiClient.getSessionOutput(sessionId, lastOffsetRef.current);
        if (result.output && result.output.length > 0) {
          term.write(result.output);
          lastOffsetRef.current = result.size; // size = end offset
          subscribed = true; // Mark as working
        }
      } catch {
        // Ignore — session might not exist yet or auth issue
      }
    };

    // Wait for WS to be connected before subscribing
    if (wsClient.connected) {
      trySubscribe();
    }
    // If not connected, the "connected" handler below will subscribe

    const handleOutput = (msg: { sessionId: string; data: string; offset: number }) => {
      if (msg.sessionId !== sessionId) return;
      subscribed = true; // We got data, subscription is working
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      // Stop HTTP polling once WS is working
      if (httpPollTimer) { clearInterval(httpPollTimer); httpPollTimer = null; }
      try {
        const raw = atob(msg.data);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i);
        }
        term.write(bytes);
        lastOffsetRef.current = msg.offset + bytes.length;
      } catch {
        term.write(msg.data);
      }
    };

    const handleError = (msg: { type: string; message: string }) => {
      // If subscribe failed (streamer not ready), retry after a delay
      if (msg.message?.includes("not found") || msg.message?.includes("not active")) {
        if (!subscribed && !disposed) {
          console.warn(`[XTerminal] Subscribe failed for ${sessionId}, retrying in 2s...`);
          term.write("\r\n\x1b[33m⏳ Connecting to session...\x1b[0m\r\n");
          retryTimer = setTimeout(() => {
            trySubscribe(lastOffsetRef.current);
          }, 2000);
        }
      }
    };

    const handleReconnect = () => {
      subscribed = false;
      trySubscribe(lastOffsetRef.current);
    };

    wsClient.on("output", handleOutput as never);
    wsClient.on("error", handleError as never);
    wsClient.on("connected", handleReconnect as never);

    // If no WS output within 3s, start HTTP polling as fallback
    retryTimer = setTimeout(() => {
      if (!subscribed && !disposed) {
        console.warn(`[XTerminal] No WS output after 3s, starting HTTP fallback for ${sessionId}`);
        // Try WS re-subscribe
        trySubscribe(0);
        // Also start HTTP polling every 2s as robust fallback
        void fetchOutputViaHttp();
        httpPollTimer = setInterval(() => {
          if (!disposed) void fetchOutputViaHttp();
        }, 2000);
      }
    }, 3000);

    // ── Input forwarding ────────────────────────────────────

    const dataDisposable = term.onData((data) => {
      wsClient.sendInput(sessionId, data);
    });

    // ── ResizeObserver ──────────────────────────────────────

    const resizeObserver = new ResizeObserver(() => doFit());
    resizeObserver.observe(container);

    // ── Cleanup ─────────────────────────────────────────────

    return () => {
      disposed = true;
      if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
      if (retryTimer) clearTimeout(retryTimer);
      if (httpPollTimer) clearInterval(httpPollTimer);
      resizeObserver.disconnect();
      dataDisposable.dispose();
      wsClient.off("output", handleOutput as never);
      wsClient.off("error", handleError as never);
      wsClient.off("connected", handleReconnect as never);
      wsClient.unsubscribe(sessionId);
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      webglAddonRef.current = null;
    };
    // Only recreate on sessionId change — settings applied live below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, doFit]);

  // ── Apply theme changes live (without recreating terminal) ─

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    const theme = THEMES[termTheme] ?? THEMES["tokyo-night"];
    term.options.theme = theme;

    // Update container background to match theme
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = theme?.background ?? "#1a1b26";
    }

    // Force WebGL addon to pick up new colors by disposing and recreating
    if (webglAddonRef.current) {
      try {
        webglAddonRef.current.dispose();
        webglAddonRef.current = null;
      } catch { /* ignore */ }

      void import("@xterm/addon-webgl").then(({ WebglAddon }) => {
        if (!terminalRef.current) return;
        try {
          const newWebgl = new WebglAddon();
          newWebgl.onContextLoss(() => {
            newWebgl.dispose();
            webglAddonRef.current = null;
          });
          terminalRef.current.loadAddon(newWebgl);
          webglAddonRef.current = newWebgl;
        } catch { /* WebGL not available */ }
      });
    }

    // Force full re-render of all rows
    term.refresh(0, term.rows - 1);
  }, [termTheme]);

  // ── Apply font size changes live ──────────────────────────

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    term.options.fontSize = termFontSize;
    doFit();
  }, [termFontSize, doFit]);

  // ── Apply cursor style changes live ───────────────────────

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    term.options.cursorStyle = termCursorStyle;
  }, [termCursorStyle]);

  // ── Apply scrollback changes live ─────────────────────────

  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;
    term.options.scrollback = termScrollback;
  }, [termScrollback]);

  // ── Focus terminal on click ───────────────────────────────

  const handleClick = useCallback(() => {
    terminalRef.current?.focus();
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("h-full w-full", className)}
      style={{ backgroundColor: (THEMES[termTheme] ?? THEMES["tokyo-night"])?.background ?? "#1a1b26" }}
      onClick={handleClick}
    />
  );
});

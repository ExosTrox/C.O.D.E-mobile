// ── XTerminal ───────────────────────────────────────────────
// Core terminal component — xterm.js with WebGL, WS streaming.

import { memo, useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { wsClient } from "../../services/ws";
import { useSessionsStore } from "../../stores/sessions.store";
import { cn } from "../../lib/cn";
import "@xterm/xterm/css/xterm.css";

// ── Tokyo Night theme ──────────────────────────────────────

const THEME = {
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
} as const;

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

    // Create terminal
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: THEME,
      scrollback: 5000,
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
  }, [sessionId, doFit]);

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

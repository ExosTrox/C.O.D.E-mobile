// ── TerminalHeader ──────────────────────────────────────────
// Compact session info bar above the terminal.

import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Copy,
  Trash2,
  RefreshCw,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useConnectionStore } from "../../stores/connection.store";
import { wsClient } from "../../services/ws";
import { cn } from "../../lib/cn";

interface TerminalHeaderProps {
  sessionId: string;
  sessionName: string;
  providerId: string;
  model: string;
  onStop: () => void;
  onCopy: () => void;
  onClear: () => void;
}

// ── Provider display names ─────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  "claude-code": "Claude",
  "openai-codex": "Codex",
  "gemini-cli": "Gemini",
  deepseek: "DeepSeek",
  openclaw: "OpenClaw",
  shell: "Terminal",
};

const PROVIDER_COLORS: Record<string, string> = {
  "claude-code": "bg-[#d97706]/20 text-[#d97706]",
  "openai-codex": "bg-[#10b981]/20 text-[#10b981]",
  "gemini-cli": "bg-[#3b82f6]/20 text-[#3b82f6]",
  deepseek: "bg-[#6366f1]/20 text-[#6366f1]",
  openclaw: "bg-[#ec4899]/20 text-[#ec4899]",
  shell: "bg-[#22d3ee]/20 text-[#22d3ee]",
};

export function TerminalHeader({
  sessionId: _sessionId,
  sessionName,
  providerId,
  model,
  onStop,
  onCopy,
  onClear,
}: TerminalHeaderProps) {
  const connectionStatus = useConnectionStore((s) => s.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  // Short model name
  const shortModel = model
    .replace(/^claude-/, "")
    .replace(/^gpt-/, "")
    .replace(/^gemini-/, "")
    .replace(/^deepseek-/, "")
    .replace(/-\d+$/, "");

  const statusDot = {
    connected: "bg-success",
    connecting: "bg-warning animate-pulse",
    disconnected: "bg-text-dimmed",
    error: "bg-error",
  }[connectionStatus];

  const StatusIcon = connectionStatus === "connected" ? Wifi : WifiOff;

  return (
    <div className="flex items-center h-10 px-2 bg-surface-1 border-b border-border gap-2 shrink-0">
      {/* Left: provider + model */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium shrink-0",
          PROVIDER_COLORS[providerId] ?? "bg-surface-2 text-text-secondary",
        )}
      >
        <span>{PROVIDER_LABELS[providerId] ?? providerId}</span>
        <span className="opacity-60">{shortModel}</span>
      </div>

      {/* Center: session name */}
      <span className="flex-1 text-xs text-text-secondary truncate text-center">
        {sessionName}
      </span>

      {/* Right: status + menu */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-1 text-text-dimmed">
          <StatusIcon className="h-3 w-3" />
          <div className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
        </div>

        {/* Overflow menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
            aria-label="Terminal menu"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-surface-2 border border-border shadow-xl z-50 py-1">
              <MenuButton
                icon={Copy}
                label="Copy output"
                onClick={() => {
                  onCopy();
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                icon={Trash2}
                label="Clear terminal"
                onClick={() => {
                  onClear();
                  setMenuOpen(false);
                }}
              />
              <MenuButton
                icon={RefreshCw}
                label="Reconnect"
                onClick={() => {
                  wsClient.disconnect();
                  const token = localStorage.getItem("code-mobile-auth");
                  if (token) {
                    try {
                      const parsed = JSON.parse(token) as { state?: { accessToken?: string } };
                      if (parsed.state?.accessToken) {
                        wsClient.connect(parsed.state.accessToken);
                      }
                    } catch {
                      // ignore
                    }
                  }
                  setMenuOpen(false);
                }}
              />
              <div className="border-t border-border my-1" />
              <MenuButton
                icon={Square}
                label="Stop session"
                danger
                onClick={() => {
                  onStop();
                  setMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MenuButton ─────────────────────────────────────────────

function MenuButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-colors",
        danger
          ? "text-error hover:bg-error/10"
          : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

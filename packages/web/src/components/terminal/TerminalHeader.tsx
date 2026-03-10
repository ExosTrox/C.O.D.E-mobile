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
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  "claude-code": "bg-[#d97706]/15 text-[#d97706]",
  "openai-codex": "bg-[#10b981]/15 text-[#10b981]",
  "gemini-cli": "bg-[#3b82f6]/15 text-[#3b82f6]",
  deepseek: "bg-[#6366f1]/15 text-[#6366f1]",
  openclaw: "bg-[#ec4899]/15 text-[#ec4899]",
  shell: "bg-[#22d3ee]/15 text-[#22d3ee]",
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
  const navigate = useNavigate();
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

  const statusColor = {
    connected: "bg-success",
    connecting: "bg-warning animate-pulse",
    disconnected: "bg-text-dimmed",
    error: "bg-error",
  }[connectionStatus];

  const StatusIcon = connectionStatus === "connected" ? Wifi : WifiOff;

  return (
    <div className="flex items-center h-11 px-1 bg-surface-0 border-b border-border/60 gap-1 shrink-0">
      {/* Back button */}
      <button
        onClick={() => navigate("/sessions")}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        aria-label="Back to sessions"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Provider badge */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold tracking-wide shrink-0",
          PROVIDER_COLORS[providerId] ?? "bg-surface-2 text-text-secondary",
        )}
      >
        <span>{PROVIDER_LABELS[providerId] ?? providerId}</span>
        <span className="opacity-50 font-normal">{shortModel}</span>
      </div>

      {/* Session name */}
      <span className="flex-1 text-xs text-text-muted truncate text-center px-1">
        {sessionName}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1 text-text-dimmed px-1">
        <StatusIcon className="h-3 w-3" />
        <div className={cn("h-1.5 w-1.5 rounded-full", statusColor)} />
      </div>

      {/* Overflow menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
          aria-label="Terminal menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-1 border border-border/60 shadow-2xl z-50 py-1.5 overflow-hidden">
            <MenuButton
              icon={Copy}
              label="Copy output"
              onClick={() => { onCopy(); setMenuOpen(false); }}
            />
            <MenuButton
              icon={Trash2}
              label="Clear terminal"
              onClick={() => { onClear(); setMenuOpen(false); }}
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
                  } catch { /* ignore */ }
                }
                setMenuOpen(false);
              }}
            />
            <div className="border-t border-border/40 my-1" />
            <MenuButton
              icon={Square}
              label="Stop session"
              danger
              onClick={() => { onStop(); setMenuOpen(false); }}
            />
          </div>
        )}
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
        "flex items-center gap-2.5 w-full px-4 py-2.5 text-xs font-medium transition-colors",
        danger
          ? "text-error hover:bg-error/10"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

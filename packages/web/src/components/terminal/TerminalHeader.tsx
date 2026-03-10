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
  "claude-code": "bg-amber-500/10 text-amber-400 border-amber-500/15",
  "openai-codex": "bg-emerald-500/10 text-emerald-400 border-emerald-500/15",
  "gemini-cli": "bg-blue-500/10 text-blue-400 border-blue-500/15",
  deepseek: "bg-indigo-500/10 text-indigo-400 border-indigo-500/15",
  openclaw: "bg-pink-500/10 text-pink-400 border-pink-500/15",
  shell: "bg-cyan-500/10 text-cyan-400 border-cyan-500/15",
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
    <div className="flex items-center h-11 px-1 bg-surface-0/80 backdrop-blur-2xl border-b border-white/[0.04] gap-1 shrink-0">
      {/* Back button */}
      <button
        onClick={() => navigate("/sessions")}
        className="p-2 rounded-lg text-text-dimmed hover:text-text-primary hover:bg-surface-2/50 transition-colors"
        aria-label="Back to sessions"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      {/* Provider badge */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold tracking-wide shrink-0 border",
          PROVIDER_COLORS[providerId] ?? "bg-surface-2/60 text-text-secondary border-white/[0.04]",
        )}
      >
        <span>{PROVIDER_LABELS[providerId] ?? providerId}</span>
        <span className="opacity-40 font-normal">{shortModel}</span>
      </div>

      {/* Session name */}
      <span className="flex-1 text-[11px] text-text-dimmed truncate text-center px-1">
        {sessionName}
      </span>

      {/* Status */}
      <div className="flex items-center gap-1.5 text-text-dimmed px-1">
        <StatusIcon className="h-3 w-3" />
        <div className={cn("h-1.5 w-1.5 rounded-full", statusColor)} />
      </div>

      {/* Overflow menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg text-text-dimmed hover:text-text-muted hover:bg-surface-2/50 transition-colors"
          aria-label="Terminal menu"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-surface-1 border border-white/[0.06] shadow-2xl z-50 py-1.5 overflow-hidden">
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
            <div className="border-t border-white/[0.04] my-1" />
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
          ? "text-error hover:bg-error/8"
          : "text-text-secondary hover:bg-surface-2/50 hover:text-text-primary",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

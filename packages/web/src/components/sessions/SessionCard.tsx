// ── SessionCard ─────────────────────────────────────────────
// Premium card for a single session with swipe actions and context menu.

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Square,
  Trash2,
  Copy,
  MoreVertical,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import type { Session } from "@code-mobile/core";
import { cn } from "../../lib/cn";

// ── Props ───────────────────────────────────────────────────

interface SessionCardProps {
  session: Session;
  onStop: (id: string) => void;
  onDelete: (id: string) => void;
}

// ── Provider styling ────────────────────────────────────────

const PROVIDER_STYLE: Record<string, { color: string; label: string; icon: string }> = {
  "claude-code": { color: "#f59e0b", label: "Claude", icon: "C" },
  "openai-codex": { color: "#10b981", label: "Codex", icon: "X" },
  "gemini-cli": { color: "#3b82f6", label: "Gemini", icon: "G" },
  deepseek: { color: "#6366f1", label: "DeepSeek", icon: "D" },
  openclaw: { color: "#ec4899", label: "OpenClaw", icon: "O" },
  shell: { color: "#06b6d4", label: "Terminal", icon: ">" },
};

const STATUS_CONFIG: Record<string, { color: string; label: string; pulse?: boolean }> = {
  starting: { color: "var(--color-warning)", label: "Starting", pulse: true },
  running: { color: "var(--color-success)", label: "Running" },
  stopped: { color: "var(--color-text-dimmed)", label: "Stopped" },
  error: { color: "var(--color-error)", label: "Error" },
  suspended: { color: "var(--color-info)", label: "Suspended" },
};

// ── Relative time ───────────────────────────────────────────

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Swipe threshold ─────────────────────────────────────────

const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 160;

// ── Component ───────────────────────────────────────────────

export const SessionCard = memo(function SessionCard({ session, onStop, onDelete }: SessionCardProps) {
  const navigate = useNavigate();
  const [swipeX, setSwipeX] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const swiping = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const provider = PROVIDER_STYLE[session.providerId] ?? {
    color: "var(--color-accent)",
    label: session.providerId,
    icon: "?",
  };
  const status = STATUS_CONFIG[session.status] ?? { color: "var(--color-text-dimmed)", label: "Unknown" };
  const isRunning = session.status === "running" || session.status === "starting";

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler, { passive: true });
    return () => document.removeEventListener("pointerdown", handler);
  }, [menuOpen]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    swiping.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      setMenuOpen(true);
    }, 500);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!swiping.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swiping.current = true;
    }

    if (swiping.current) {
      e.preventDefault();
      const clamped = Math.max(-ACTION_WIDTH, Math.min(0, dx));
      setSwipeX(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (Math.abs(swipeX) > SWIPE_THRESHOLD) {
      setSwipeX(-ACTION_WIDTH);
    } else {
      setSwipeX(0);
    }
    touchStartRef.current = null;
    swiping.current = false;
  }, [swipeX]);

  const handleClick = useCallback(() => {
    if (swiping.current || menuOpen) return;
    if (swipeX !== 0) {
      setSwipeX(0);
      return;
    }
    navigate(`/terminal/${session.id}`);
  }, [session.id, navigate, swipeX, menuOpen]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(true);
  }, []);

  const copyId = useCallback(() => {
    void navigator.clipboard.writeText(session.id);
    setMenuOpen(false);
  }, [session.id]);

  return (
    <div className="relative overflow-hidden rounded-2xl group">
      {/* Swipe-reveal actions */}
      <div className="absolute inset-y-0 right-0 flex items-stretch md:hidden">
        {isRunning && (
          <button
            onClick={() => { onStop(session.id); setSwipeX(0); }}
            className="flex items-center justify-center w-20 bg-warning/90 text-white"
          >
            <div className="flex flex-col items-center gap-0.5">
              <Square className="h-4 w-4" />
              <span className="text-[10px] font-medium">Stop</span>
            </div>
          </button>
        )}
        <button
          onClick={() => { onDelete(session.id); setSwipeX(0); }}
          className="flex items-center justify-center w-20 bg-error/90 text-white"
        >
          <div className="flex flex-col items-center gap-0.5">
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px] font-medium">Delete</span>
          </div>
        </button>
      </div>

      {/* Card content */}
      <div
        className={cn(
          "relative rounded-2xl cursor-pointer will-change-transform card-hover",
          "bg-gradient-to-br from-surface-1/80 to-surface-1/40",
          "border border-white/[0.05]",
          "hover:border-white/[0.08]",
        )}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping.current ? "none" : "transform 0.2s ease-out",
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left accent bar */}
        <div
          className="card-accent-bar"
          style={{ backgroundColor: provider.color }}
        />

        <div className="flex items-center gap-3.5 p-4 pl-5">
          {/* Provider icon */}
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 provider-icon"
            style={{
              background: `linear-gradient(135deg, ${provider.color}18, ${provider.color}08)`,
              border: `1px solid ${provider.color}20`,
            }}
          >
            <span
              className="text-sm font-bold relative z-10"
              style={{ color: provider.color }}
            >
              {provider.icon}
            </span>
          </div>

          {/* Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-primary truncate tracking-tight">
                {session.name}
              </span>
              {isRunning && (
                <Sparkles
                  className="h-3 w-3 shrink-0 text-success/60"
                  strokeWidth={2.5}
                />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span
                className="text-[11px] font-medium"
                style={{ color: `${provider.color}99` }}
              >
                {provider.label}
              </span>
              <span className="text-text-dimmed/60 text-[6px]">&#9679;</span>
              <span className="text-[11px] text-text-muted font-mono truncate">
                {session.model}
              </span>
              <span className="text-text-dimmed/60 text-[6px]">&#9679;</span>
              <span className="text-[11px] text-text-dimmed shrink-0">
                {relativeTime(session.createdAt)}
              </span>
            </div>
          </div>

          {/* Status + menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-0/50">
              <div
                className={cn("h-1.5 w-1.5 rounded-full", status.pulse && "status-pulse")}
                style={{ backgroundColor: status.color }}
              />
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: status.color }}
              >
                {status.label}
              </span>
            </div>

            {/* Desktop menu */}
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 rounded-lg text-text-dimmed hover:text-text-muted hover:bg-surface-2/50 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Session menu"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-surface-2 border border-white/[0.08] shadow-2xl z-50 py-1 overflow-hidden">
                  {isRunning && (
                    <MenuAction
                      icon={Square}
                      label="Stop"
                      onClick={() => { onStop(session.id); setMenuOpen(false); }}
                    />
                  )}
                  <MenuAction
                    icon={Trash2}
                    label="Delete"
                    danger
                    onClick={() => { onDelete(session.id); setMenuOpen(false); }}
                  />
                  <MenuAction
                    icon={Copy}
                    label="Copy ID"
                    onClick={copyId}
                  />
                </div>
              )}
            </div>

            {/* Mobile chevron */}
            <ChevronRight className="h-3.5 w-3.5 text-text-dimmed/50 md:hidden" />
          </div>
        </div>
      </div>

      {/* Mobile context menu (long press) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface-1 rounded-t-3xl border-t border-white/[0.08] safe-bottom p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full bg-surface-3 mx-auto mb-3 mt-1" />
            <div className="flex items-center gap-3 px-4 pb-3 mb-1 border-b border-white/[0.04]">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${provider.color}18, ${provider.color}08)`,
                }}
              >
                <span className="text-xs font-bold" style={{ color: provider.color }}>
                  {provider.icon}
                </span>
              </div>
              <span className="text-sm font-medium text-text-primary truncate">{session.name}</span>
            </div>
            {isRunning && (
              <MenuAction
                icon={Square}
                label="Stop session"
                onClick={() => { onStop(session.id); setMenuOpen(false); }}
              />
            )}
            <MenuAction
              icon={Trash2}
              label="Delete session"
              danger
              onClick={() => { onDelete(session.id); setMenuOpen(false); }}
            />
            <MenuAction
              icon={Copy}
              label="Copy session ID"
              onClick={copyId}
            />
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full mt-1 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-surface-2/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ── MenuAction ──────────────────────────────────────────────

function MenuAction({
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
        "flex items-center gap-2.5 w-full px-4 py-3 text-sm rounded-xl transition-colors",
        danger
          ? "text-error hover:bg-error/8"
          : "text-text-secondary hover:bg-surface-2/50 hover:text-text-primary",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

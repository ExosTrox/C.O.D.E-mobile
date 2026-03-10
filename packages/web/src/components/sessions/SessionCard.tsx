// ── SessionCard ─────────────────────────────────────────────
// Visual card for a single session with swipe actions and context menu.

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Square,
  Trash2,
  Copy,
  MoreVertical,
  ChevronRight,
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

const PROVIDER_STYLE: Record<string, { bg: string; text: string; label: string; gradient: string }> = {
  "claude-code": { bg: "bg-amber-500/10", text: "text-amber-400", label: "Claude", gradient: "from-amber-500/20 to-amber-600/5" },
  "openai-codex": { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Codex", gradient: "from-emerald-500/20 to-emerald-600/5" },
  "gemini-cli": { bg: "bg-blue-500/10", text: "text-blue-400", label: "Gemini", gradient: "from-blue-500/20 to-blue-600/5" },
  deepseek: { bg: "bg-indigo-500/10", text: "text-indigo-400", label: "DeepSeek", gradient: "from-indigo-500/20 to-indigo-600/5" },
  openclaw: { bg: "bg-pink-500/10", text: "text-pink-400", label: "OpenClaw", gradient: "from-pink-500/20 to-pink-600/5" },
  shell: { bg: "bg-cyan-500/10", text: "text-cyan-400", label: "Terminal", gradient: "from-cyan-500/20 to-cyan-600/5" },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string; textColor: string }> = {
  starting: { dot: "bg-warning animate-pulse", label: "Starting", textColor: "text-warning" },
  running: { dot: "bg-success", label: "Running", textColor: "text-success" },
  stopped: { dot: "bg-text-dimmed", label: "Stopped", textColor: "text-text-dimmed" },
  error: { dot: "bg-error", label: "Error", textColor: "text-error" },
  suspended: { dot: "bg-info", label: "Suspended", textColor: "text-info" },
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
    bg: "bg-surface-3",
    text: "text-text-secondary",
    label: session.providerId,
    gradient: "from-surface-3 to-surface-2",
  };
  const status = STATUS_CONFIG[session.status] ?? { dot: "bg-text-dimmed", label: "Unknown", textColor: "text-text-dimmed" };

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
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe-reveal actions */}
      <div className="absolute inset-y-0 right-0 flex items-stretch md:hidden">
        {session.status === "running" && (
          <button
            onClick={() => { onStop(session.id); setSwipeX(0); }}
            className="flex items-center justify-center w-20 bg-warning/80 text-white"
          >
            <div className="flex flex-col items-center gap-0.5">
              <Square className="h-4 w-4" />
              <span className="text-[10px] font-medium">Stop</span>
            </div>
          </button>
        )}
        <button
          onClick={() => { onDelete(session.id); setSwipeX(0); }}
          className="flex items-center justify-center w-20 bg-error/80 text-white"
        >
          <div className="flex flex-col items-center gap-0.5">
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px] font-medium">Delete</span>
          </div>
        </button>
      </div>

      {/* Card content */}
      <div
        className="relative bg-surface-1/50 border border-white/[0.04] rounded-xl p-3.5 cursor-pointer transition-colors will-change-transform hover:bg-surface-1/80 hover:border-white/[0.06] active:bg-surface-2/60"
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
        <div className="flex items-center gap-3">
          {/* Provider icon */}
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br",
            provider.gradient,
            "border border-white/[0.04]",
          )}>
            <span className={cn("text-sm font-bold", provider.text)}>
              {provider.label.charAt(0)}
            </span>
          </div>

          {/* Session info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary truncate">
                {session.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-text-muted truncate">
                {provider.label}
              </span>
              <span className="text-text-dimmed text-[8px]">&bull;</span>
              <span className="text-[11px] text-text-dimmed font-mono truncate">
                {session.model}
              </span>
              <span className="text-text-dimmed text-[8px]">&bull;</span>
              <span className="text-[11px] text-text-dimmed shrink-0">
                {relativeTime(session.createdAt)}
              </span>
            </div>
          </div>

          {/* Status + menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface-2/40">
              <div className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              <span className={cn("text-[10px] font-medium", status.textColor)}>
                {status.label}
              </span>
            </div>

            {/* Desktop menu */}
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1.5 rounded-lg text-text-dimmed hover:text-text-muted hover:bg-surface-2/50 transition-colors"
                aria-label="Session menu"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-surface-1 border border-white/[0.06] shadow-2xl z-50 py-1.5 overflow-hidden">
                  {session.status === "running" && (
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
            <ChevronRight className="h-3.5 w-3.5 text-text-dimmed md:hidden" />
          </div>
        </div>
      </div>

      {/* Mobile context menu (long press) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface-1 rounded-t-2xl border-t border-white/[0.06] safe-bottom p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-8 h-1 rounded-full bg-surface-3 mx-auto mb-3" />
            <p className="text-xs text-text-muted px-3 pb-2 truncate">{session.name}</p>
            {session.status === "running" && (
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
        "flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-xl transition-colors",
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

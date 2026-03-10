// ── SessionCard ─────────────────────────────────────────────
// Visual card for a single session with swipe actions and context menu.

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Square,
  Trash2,
  Copy,
  MoreVertical,
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

const PROVIDER_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  "claude-code": { bg: "bg-[#d97706]/20", text: "text-[#d97706]", label: "Claude" },
  "openai-codex": { bg: "bg-[#10b981]/20", text: "text-[#10b981]", label: "Codex" },
  "gemini-cli": { bg: "bg-[#3b82f6]/20", text: "text-[#3b82f6]", label: "Gemini" },
  deepseek: { bg: "bg-[#6366f1]/20", text: "text-[#6366f1]", label: "DeepSeek" },
  openclaw: { bg: "bg-[#ec4899]/20", text: "text-[#ec4899]", label: "OpenClaw" },
  shell: { bg: "bg-[#22d3ee]/20", text: "text-[#22d3ee]", label: "Terminal" },
};

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  starting: { dot: "bg-warning animate-pulse", label: "Starting" },
  running: { dot: "bg-success", label: "Running" },
  stopped: { dot: "bg-text-dimmed", label: "Stopped" },
  error: { dot: "bg-error", label: "Error" },
  suspended: { dot: "bg-info", label: "Suspended" },
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
    bg: "bg-surface-2",
    text: "text-text-secondary",
    label: session.providerId,
  };
  const status = STATUS_CONFIG[session.status] ?? { dot: "bg-text-dimmed", label: "Unknown" };

  // ── Close menu on outside click ────────────────────────────

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

  // ── Touch handlers for swipe ──────────────────────────────

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

  // ── Navigate on tap ───────────────────────────────────────

  const handleClick = useCallback(() => {
    if (swiping.current || menuOpen) return;
    if (swipeX !== 0) {
      setSwipeX(0);
      return;
    }
    navigate(`/terminal/${session.id}`);
  }, [session.id, navigate, swipeX, menuOpen]);

  // ── Context menu handler ──────────────────────────────────

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
      {/* Swipe-reveal actions (behind the card) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch md:hidden">
        {session.status === "running" && (
          <button
            onClick={() => { onStop(session.id); setSwipeX(0); }}
            className="flex items-center justify-center w-20 bg-warning/90 text-surface-0"
          >
            <div className="flex flex-col items-center gap-0.5">
              <Square className="h-4 w-4" />
              <span className="text-[10px] font-medium">Stop</span>
            </div>
          </button>
        )}
        <button
          onClick={() => { onDelete(session.id); setSwipeX(0); }}
          className="flex items-center justify-center w-20 bg-error/90 text-surface-0"
        >
          <div className="flex flex-col items-center gap-0.5">
            <Trash2 className="h-4 w-4" />
            <span className="text-[10px] font-medium">Delete</span>
          </div>
        </button>
      </div>

      {/* Card content (slides on swipe) */}
      <div
        className="relative bg-surface-1 border border-border rounded-xl p-3 cursor-pointer active:bg-surface-2 transition-colors will-change-transform"
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
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", provider.bg)}>
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
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted truncate">
                {provider.label} &middot; {session.model}
              </span>
              <span className="text-xs text-text-dimmed shrink-0">
                {relativeTime(session.createdAt)}
              </span>
            </div>
          </div>

          {/* Status + menu */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", status.dot)} />
              <span className={cn(
                "text-xs",
                session.status === "running" ? "text-success" :
                session.status === "error" ? "text-error" :
                "text-text-dimmed",
              )}>
                {status.label}
              </span>
            </div>

            {/* Desktop overflow menu */}
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
                aria-label="Session menu"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-surface-2 border border-border shadow-xl z-50 py-1">
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
          </div>
        </div>
      </div>

      {/* Mobile context menu (long press) */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface-2 rounded-t-2xl border-t border-border safe-bottom p-2"
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
              className="w-full mt-1 py-2.5 rounded-lg text-sm text-text-secondary hover:bg-surface-3 transition-colors"
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
        "flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-lg transition-colors",
        danger
          ? "text-error hover:bg-error/10"
          : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

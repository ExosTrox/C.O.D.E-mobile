// ── SessionsPage ────────────────────────────────────────────
// Sessions list with filter chips, pull-to-refresh, and FAB.

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Terminal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SessionStatus } from "@code-mobile/core";
import { Header } from "../components/layout/Header";
import { SessionCard } from "../components/sessions/SessionCard";
import { NewSessionModal } from "../components/sessions/NewSessionModal";
import { useSessions, useStopSession, useDeleteSession } from "../hooks/use-sessions";
import { ApiError } from "../services/api";
import { cn } from "../lib/cn";

// ── Filter options ──────────────────────────────────────────

type FilterValue = "all" | "running" | "stopped";

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
];

// ── Pull-to-refresh threshold ───────────────────────────────

const PULL_THRESHOLD = 60;

// ── Component ───────────────────────────────────────────────

export function SessionsPage() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const statusFilter: SessionStatus | undefined =
    filter === "all" ? undefined : filter;

  const { data: sessions, isLoading, refetch, isRefetching } = useSessions(statusFilter);
  const stopSession = useStopSession();
  const deleteSession = useDeleteSession();

  // ── Pull-to-refresh handlers ──────────────────────────────

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = listRef.current;
    const touch = e.touches[0];
    if (el && el.scrollTop === 0 && touch) {
      touchStartY.current = touch.clientY;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dy = touch.clientY - touchStartY.current;
    if (dy > 0) {
      setPulling(true);
      setPullY(Math.min(dy * 0.4, PULL_THRESHOLD * 1.5));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (pullY >= PULL_THRESHOLD) {
      void refetch();
    }
    setPullY(0);
    setPulling(false);
    touchStartY.current = null;
  }, [pullY, refetch]);

  // ── Actions ───────────────────────────────────────────────

  const handleStop = useCallback(
    (id: string) => {
      stopSession.mutate(id, {
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Failed to stop session");
        },
      });
    },
    [stopSession],
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteSession.mutate(id, {
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete session");
        },
      });
    },
    [deleteSession],
  );

  const isEmpty = !isLoading && (!sessions || sessions.length === 0);

  return (
    <>
      <Header title="Sessions" />

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <AnimatePresence>
          {pulling && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: pullY, opacity: pullY >= PULL_THRESHOLD ? 1 : 0.5 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <Loader2
                className={cn(
                  "h-5 w-5 text-accent transition-transform",
                  pullY >= PULL_THRESHOLD && "animate-spin",
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refetch indicator (non-pull) */}
        {isRefetching && !pulling && (
          <div className="flex justify-center py-1">
            <div className="h-0.5 w-16 bg-accent/30 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-2 px-4 py-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-accent/15 text-accent"
                  : "bg-surface-2 text-text-muted hover:text-text-secondary hover:bg-surface-3",
              )}
            >
              {f.label}
              {f.value !== "all" && sessions && (
                <span className="ml-1 opacity-60">
                  {sessions.filter((s) =>
                    f.value === "running"
                      ? s.status === "running" || s.status === "starting"
                      : s.status === "stopped" || s.status === "error",
                  ).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 text-accent animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center px-4 py-16">
            <div className="text-center space-y-4">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto"
              >
                <Terminal className="h-7 w-7 text-accent" />
              </motion.div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-text-primary">
                  No sessions yet
                </h2>
                <p className="text-sm text-text-muted max-w-xs">
                  Create your first session to start coding with AI.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-surface-0 text-sm font-medium hover:bg-accent-hover transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first session
              </button>
            </div>
          </div>
        )}

        {/* Session list */}
        {!isLoading && sessions && sessions.length > 0 && (
          <div className="px-4 pb-24 space-y-2">
            {sessions.map((session, i) => (
              <SessionCard
                key={session.id}
                session={session}
                index={i}
                onStop={handleStop}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB — create new session */}
      {!isEmpty && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full bg-accent text-surface-0 shadow-lg shadow-accent/25 flex items-center justify-center hover:bg-accent-hover active:scale-95 transition-all"
          aria-label="New session"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* New session modal */}
      <NewSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

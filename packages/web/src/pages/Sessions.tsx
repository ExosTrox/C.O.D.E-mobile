// ── SessionsPage ────────────────────────────────────────────
// Sessions list with filter chips, pull-to-refresh, and FAB.

import { useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Terminal, Loader2, Zap } from "lucide-react";
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
  const runningCount = sessions?.filter((s) => s.status === "running" || s.status === "starting").length ?? 0;

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
              animate={{ height: pullY, opacity: pullY >= PULL_THRESHOLD ? 1 : 0.4 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-center overflow-hidden"
            >
              <Loader2
                className={cn(
                  "h-4 w-4 text-accent transition-transform",
                  pullY >= PULL_THRESHOLD && "animate-spin",
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refetch indicator */}
        {isRefetching && !pulling && (
          <div className="flex justify-center py-1.5">
            <div className="h-0.5 w-12 bg-accent/20 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
        )}

        {/* Greeting + stats */}
        <div className="px-5 pt-5 pb-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary tracking-tight">
              Sessions
            </h2>
            {sessions && sessions.length > 0 && (
              <div className="flex items-center gap-2">
                {runningCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-success/8 text-success text-[11px] font-medium border border-success/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                    {runningCount} active
                  </span>
                )}
                <span className="text-[11px] text-text-dimmed">
                  {sessions.length} total
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 px-5 py-2">
          {FILTERS.map((f) => {
            const count = f.value !== "all" && sessions
              ? sessions.filter((s) =>
                  f.value === "running"
                    ? s.status === "running" || s.status === "starting"
                    : s.status === "stopped" || s.status === "error",
                ).length
              : null;

            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                  filter === f.value
                    ? "bg-accent/10 text-accent border border-accent/15"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-2/50 border border-transparent",
                )}
              >
                {f.label}
                {count !== null && count > 0 && (
                  <span className="ml-1 opacity-50">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="space-y-3 text-center">
              <Loader2 className="h-5 w-5 text-accent animate-spin mx-auto" />
              <p className="text-xs text-text-dimmed">Loading sessions</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="flex-1 flex items-center justify-center px-6 py-20">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center space-y-6 max-w-xs"
            >
              <div className="relative mx-auto w-fit">
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="h-16 w-16 rounded-2xl bg-gradient-to-br from-accent/10 to-purple-500/5 flex items-center justify-center border border-accent/10"
                >
                  <Terminal className="h-7 w-7 text-accent" />
                </motion.div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 bg-accent/5 rounded-full blur-md" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-semibold text-text-primary">
                  No sessions yet
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Start your first AI coding session to begin.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all hover:shadow-lg hover:shadow-accent/15 active:scale-[0.98]"
              >
                <Zap className="h-3.5 w-3.5" />
                New Session
              </button>
            </motion.div>
          </div>
        )}

        {/* Session list */}
        {!isLoading && sessions && sessions.length > 0 && (
          <div className="px-4 pb-24 space-y-1.5 pt-1">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
              >
                <SessionCard
                  session={session}
                  onStop={handleStop}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {!isEmpty && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 20 }}
          onClick={() => setModalOpen(true)}
          className="fixed bottom-20 right-5 md:bottom-6 md:right-6 z-40 h-13 w-13 rounded-2xl bg-accent text-white shadow-xl shadow-accent/20 flex items-center justify-center hover:bg-accent-hover active:scale-95 transition-all hover:shadow-accent/30"
          aria-label="New session"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      )}

      {/* New session modal */}
      <NewSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

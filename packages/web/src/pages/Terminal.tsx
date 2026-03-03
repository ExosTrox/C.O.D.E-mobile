// ── TerminalPage ────────────────────────────────────────────
// Full terminal view: header + xterm + toolbar.

import { useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { XTerminal } from "../components/terminal/XTerminal";
import { TerminalToolbar } from "../components/terminal/TerminalToolbar";
import { TerminalHeader } from "../components/terminal/TerminalHeader";
import { useSession, useStopSession } from "../hooks/use-sessions";
import { useSessionsStore } from "../stores/sessions.store";

export function TerminalPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const setActiveSession = useSessionsStore((s) => s.setActiveSession);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: session, isLoading, error } = useSession(sessionId ?? null);
  const stopSession = useStopSession();

  // Track active session
  useEffect(() => {
    if (sessionId) {
      setActiveSession(sessionId);
    }
    return () => setActiveSession(null);
  }, [sessionId, setActiveSession]);

  // Handle keyboard resize (visualViewport API)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const container = containerRef.current;
      if (!container) return;
      // Adjust height when virtual keyboard appears
      container.style.height = `${vv.height}px`;
    };

    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  const handleStop = useCallback(() => {
    if (!sessionId) return;
    stopSession.mutate(sessionId, {
      onSuccess: () => navigate("/sessions", { replace: true }),
    });
  }, [sessionId, stopSession, navigate]);

  const handleCopy = useCallback(() => {
    // Copy terminal selection or full scrollback via clipboard API
    const selection = window.getSelection()?.toString();
    if (selection) {
      void navigator.clipboard.writeText(selection);
    }
  }, []);

  const handleClear = useCallback(() => {
    // Send clear command (Ctrl-L equivalent)
    // The terminal component handles this via its own ref
  }, []);

  // No sessionId in URL
  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-text-dimmed mx-auto" />
          <h2 className="text-lg font-semibold text-text-primary">
            No session selected
          </h2>
          <p className="text-sm text-text-muted max-w-xs">
            Pick a session from the list or create a new one.
          </p>
          <Link
            to="/sessions"
            className="inline-block px-4 py-2 rounded-lg bg-accent text-surface-0 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            View Sessions
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Error or session not found
  if (error || !session) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-error mx-auto" />
          <h2 className="text-lg font-semibold text-text-primary">
            Session not found
          </h2>
          <p className="text-sm text-text-muted max-w-xs">
            This session may have been stopped or doesn&apos;t exist.
          </p>
          <Link
            to="/sessions"
            className="inline-block px-4 py-2 rounded-lg bg-accent text-surface-0 text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            View Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden terminal-page"
    >
      <TerminalHeader
        sessionId={session.id}
        sessionName={session.name}
        providerId={session.providerId}
        model={session.model}
        onStop={handleStop}
        onCopy={handleCopy}
        onClear={handleClear}
      />

      <XTerminal
        sessionId={session.id}
        className="flex-1 min-h-0"
      />

      <TerminalToolbar sessionId={session.id} />
    </div>
  );
}

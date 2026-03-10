// ── DefaultRedirect ─────────────────────────────────────────
// Smart redirect based on auth state.
// Reads localStorage directly to avoid zustand async hydration race.

import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { getPersistedAuth } from "../../stores/auth.store";

export function DefaultRedirect() {
  const { isAuthenticated, isSetupComplete } = useAuth();
  const persisted = getPersistedAuth();

  const authed = isAuthenticated || !!persisted.accessToken;
  const setupDone = isSetupComplete || persisted.isSetupComplete;

  if (authed) {
    return <Navigate to="/sessions" replace />;
  }

  if (setupDone) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/connect" replace />;
}

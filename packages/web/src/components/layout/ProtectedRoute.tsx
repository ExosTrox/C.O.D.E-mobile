// ── ProtectedRoute ──────────────────────────────────────────
// Redirects unauthenticated users to login/connect.
// Reads localStorage directly to avoid zustand async hydration race.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { getPersistedAuth } from "../../stores/auth.store";

export function ProtectedRoute() {
  const { isAuthenticated, isSetupComplete } = useAuth();

  // Zustand persist hydrates asynchronously — the store may still show
  // default values (null tokens). Read localStorage directly as fallback.
  const persisted = getPersistedAuth();
  const authed = isAuthenticated || !!persisted.accessToken;
  const setupDone = isSetupComplete || persisted.isSetupComplete;

  if (!setupDone) {
    return <Navigate to="/connect" replace />;
  }

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

// ── ProtectedRoute ──────────────────────────────────────────
// Redirects unauthenticated users to login/connect.
// Waits for zustand persist hydration to prevent flash redirect.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { useAuthHydrated } from "../../stores/auth.store";

export function ProtectedRoute() {
  const hydrated = useAuthHydrated();
  const { isAuthenticated, isSetupComplete } = useAuth();

  // Wait for localStorage hydration before making auth decisions
  if (!hydrated) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen bg-surface-0">
        <div className="h-6 w-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSetupComplete) {
    return <Navigate to="/connect" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

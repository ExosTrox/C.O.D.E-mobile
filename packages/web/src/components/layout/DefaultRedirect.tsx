// ── DefaultRedirect ─────────────────────────────────────────
// Smart redirect based on auth state. Waits for hydration.

import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";
import { useAuthHydrated } from "../../stores/auth.store";

export function DefaultRedirect() {
  const hydrated = useAuthHydrated();
  const { isAuthenticated, isSetupComplete } = useAuth();

  if (!hydrated) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/sessions" replace />;
  }

  if (isSetupComplete) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to="/connect" replace />;
}

// ── DefaultRedirect ─────────────────────────────────────────
// Smart redirect based on auth state.

import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";

export function DefaultRedirect() {
  const { isAuthenticated, isSetupComplete } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/sessions" replace />;
  }

  return <Navigate to="/connect" replace />;
}

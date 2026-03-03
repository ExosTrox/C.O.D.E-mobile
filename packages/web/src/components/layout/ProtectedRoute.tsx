// ── ProtectedRoute ──────────────────────────────────────────
// Redirects unauthenticated users to login/connect.

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/use-auth";

export function ProtectedRoute() {
  const { isAuthenticated, isSetupComplete } = useAuth();

  if (!isSetupComplete) {
    return <Navigate to="/connect" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

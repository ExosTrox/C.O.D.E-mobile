import { useAuthStore } from "../stores/auth.store";

export function useAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isSetupComplete = useAuthStore((s) => s.isSetupComplete);
  const isFirstRun = useAuthStore((s) => s.isFirstRun);
  const logout = useAuthStore((s) => s.logout);

  return {
    isAuthenticated: !!accessToken,
    isSetupComplete,
    isFirstRun,
    logout,
  };
}

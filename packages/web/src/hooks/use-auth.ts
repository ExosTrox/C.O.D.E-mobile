import { useAuthStore } from "../stores/auth.store";

export function useAuth() {
  const { accessToken, isSetupComplete, logout } = useAuthStore();

  return {
    isAuthenticated: !!accessToken,
    isSetupComplete,
    logout,
  };
}

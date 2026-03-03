import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isSetupComplete: boolean;
  setTokens: (access: string, refresh: string) => void;
  setSetupComplete: (complete: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isSetupComplete: false,
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),
      setSetupComplete: (complete) => set({ isSetupComplete: complete }),
      logout: () =>
        set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: "code-mobile-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isSetupComplete: state.isSetupComplete,
      }),
    },
  ),
);

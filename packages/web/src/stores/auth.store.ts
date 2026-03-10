// ── Auth Store ──────────────────────────────────────────────

import { useState, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  // State
  accessToken: string | null;
  refreshToken: string | null;
  isSetupComplete: boolean;
  serverUrl: string;
  isFirstRun: boolean;

  // Computed
  isAuthenticated: boolean;

  // Actions
  setTokens: (access: string, refresh: string) => void;
  setSetupComplete: (complete: boolean) => void;
  setServerUrl: (url: string) => void;
  setIsFirstRun: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // State
      accessToken: null,
      refreshToken: null,
      isSetupComplete: false,
      serverUrl: window.location.origin,
      isFirstRun: true,

      // Computed
      get isAuthenticated() {
        return !!get().accessToken;
      },

      // Actions
      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      setSetupComplete: (complete) =>
        set({ isSetupComplete: complete, isFirstRun: !complete }),

      setServerUrl: (url) => set({ serverUrl: url }),

      setIsFirstRun: (value) => set({ isFirstRun: value }),

      logout: () =>
        set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: "code-mobile-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isSetupComplete: state.isSetupComplete,
        serverUrl: state.serverUrl,
        isFirstRun: state.isFirstRun,
      }),
    },
  ),
);

// ── Hydration helper ────────────────────────────────────────
// Zustand persist hydrates async from localStorage. Components that
// check auth on first render (e.g. ProtectedRoute) must wait for
// hydration to avoid a flash redirect to /login.

export const useAuthHydrated = () => {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    // Already hydrated (fast path)
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
};

// ── Auth Store ──────────────────────────────────────────────

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  // State
  accessToken: string | null;
  refreshToken: string | null;
  isSetupComplete: boolean;
  serverUrl: string;
  isFirstRun: boolean;
  _hydrated: boolean;

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
      _hydrated: false,

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
      onRehydrateStorage: () => {
        return () => {
          // Called after hydration completes — set flag in store
          useAuthStore.setState({ _hydrated: true });
        };
      },
    },
  ),
);

// ── Hydration helper ────────────────────────────────────────
// Read auth state directly from localStorage to avoid async hydration race.
// This is called synchronously during render — no hooks needed.

export function getPersistedAuth(): {
  accessToken: string | null;
  isSetupComplete: boolean;
} {
  try {
    const raw = localStorage.getItem("code-mobile-auth");
    if (!raw) return { accessToken: null, isSetupComplete: false };
    const data = JSON.parse(raw);
    const state = data?.state ?? data;
    return {
      accessToken: state?.accessToken ?? null,
      isSetupComplete: state?.isSetupComplete ?? false,
    };
  } catch {
    return { accessToken: null, isSetupComplete: false };
  }
}

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

// ── Persisted auth reader ───────────────────────────────────
// Read auth state directly from localStorage to avoid zustand's
// async hydration race. Called synchronously during render.

export function getPersistedAuth(): {
  accessToken: string | null;
  refreshToken: string | null;
  isSetupComplete: boolean;
} {
  try {
    const raw = localStorage.getItem("code-mobile-auth");
    if (!raw) return { accessToken: null, refreshToken: null, isSetupComplete: false };
    const data = JSON.parse(raw);
    // Zustand persist v5 stores as { state: { ... }, version: 0 }
    const state = data?.state ?? data;
    return {
      accessToken: state?.accessToken ?? null,
      refreshToken: state?.refreshToken ?? null,
      isSetupComplete: state?.isSetupComplete ?? false,
    };
  } catch {
    return { accessToken: null, refreshToken: null, isSetupComplete: false };
  }
}

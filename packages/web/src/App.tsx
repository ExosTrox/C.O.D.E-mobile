import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { Shell } from "./components/layout/Shell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DefaultRedirect } from "./components/layout/DefaultRedirect";
import { PageLoader } from "./components/ui/PageLoader";
import { useThemeSync } from "./hooks/use-theme";

// Critical path: loaded eagerly (login/connect flow)
import { ConnectPage } from "./pages/Connect";
import { LoginPage } from "./pages/Login";
import { SignupPage } from "./pages/Signup";

// Lazy-loaded pages (code-split)
const SetupPage = lazy(() => import("./pages/Setup").then((m) => ({ default: m.SetupPage })));
const SessionsPage = lazy(() => import("./pages/Sessions").then((m) => ({ default: m.SessionsPage })));
const TerminalPage = lazy(() => import("./pages/Terminal").then((m) => ({ default: m.TerminalPage })));
const ProvidersPage = lazy(() => import("./pages/Providers").then((m) => ({ default: m.ProvidersPage })));
const SettingsPage = lazy(() => import("./pages/Settings").then((m) => ({ default: m.SettingsPage })));
const AnalyticsPage = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.AnalyticsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  useThemeSync();

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/connect" element={<ConnectPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/setup" element={<SetupPage />} />

            {/* Protected routes with shell layout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Shell />}>
                <Route path="/sessions" element={<SessionsPage />} />
                <Route path="/terminal/:sessionId" element={<TerminalPage />} />
                <Route path="/providers" element={<ProvidersPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Smart default redirect */}
            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-primary)",
          },
        }}
      />
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

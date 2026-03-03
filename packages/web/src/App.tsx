import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { Shell } from "./components/layout/Shell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DefaultRedirect } from "./components/layout/DefaultRedirect";
import { ConnectPage } from "./pages/Connect";
import { LoginPage } from "./pages/Login";
import { SetupPage } from "./pages/Setup";
import { TerminalPage } from "./pages/Terminal";
import { SessionsPage } from "./pages/Sessions";
import { ProvidersPage } from "./pages/Providers";
import { SettingsPage } from "./pages/Settings";
import { AnalyticsPage } from "./pages/Analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/login" element={<LoginPage />} />
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
      </BrowserRouter>

      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1f2335",
            border: "1px solid #292e42",
            color: "#c0caf5",
          },
        }}
      />
    </QueryClientProvider>
  );
}

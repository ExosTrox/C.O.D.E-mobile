// ── ConnectPage ─────────────────────────────────────────────
// First screen: connect to a CODE Mobile server.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Loader2, Wifi } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient } from "../services/api";

export function ConnectPage() {
  const navigate = useNavigate();
  const { setServerUrl, setSetupComplete, isAuthenticated } = useAuthStore();

  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);

  // Auto-detect: if accessed on the server's own domain, try connecting automatically
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/sessions", { replace: true });
      return;
    }

    const origin = window.location.origin;
    // Skip auto-detect for localhost dev servers (Vite)
    if (origin.includes("localhost:5") || origin.includes("127.0.0.1:5")) {
      setAutoChecking(false);
      return;
    }

    apiClient
      .checkHealth(origin)
      .then((health) => {
        // Server is at same origin — skip Connect page
        setServerUrl(origin);
        apiClient.setServerUrl(origin);
        if (health.isSetupComplete === false) {
          setSetupComplete(false);
          navigate("/setup", { replace: true });
        } else {
          setSetupComplete(true);
          navigate("/login", { replace: true });
        }
      })
      .catch(() => {
        setAutoChecking(false);
      });
  }, [isAuthenticated, navigate, setServerUrl, setSetupComplete]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const serverUrl = url.replace(/\/+$/, "");
    if (!serverUrl) return;

    setLoading(true);

    try {
      const health = await apiClient.checkHealth(serverUrl);

      // Save URL
      setServerUrl(serverUrl);
      apiClient.setServerUrl(serverUrl);

      if (health.isSetupComplete === false) {
        setSetupComplete(false);
        navigate("/setup", { replace: true });
      } else {
        setSetupComplete(true);
        navigate("/login", { replace: true });
      }
    } catch {
      setError("Could not reach server. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (autoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" />
          <p className="text-sm text-text-muted">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <Terminal className="h-8 w-8 text-accent" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text-primary">CODE Mobile</h1>
            <p className="text-sm text-text-muted">
              Connect to your server
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error flex items-center gap-2">
              <Wifi className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Server URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
              placeholder="https://your-server.example.com"
              required
              autoFocus
              autoComplete="url"
            />
            <p className="text-xs text-text-dimmed">
              The address where your CODE Mobile daemon is running
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

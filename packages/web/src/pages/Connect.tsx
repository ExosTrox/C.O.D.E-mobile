// ── ConnectPage ─────────────────────────────────────────────
// First screen: enter a bootstrap code or connect to a server.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Loader2, Wifi, KeyRound } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient } from "../services/api";
import { getDeviceName } from "../lib/device";

export function ConnectPage() {
  const navigate = useNavigate();
  const { setServerUrl, setSetupComplete, setTokens, isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<"code" | "url">("code");
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect: if accessed on the server's own domain, skip to code entry
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/sessions", { replace: true });
      return;
    }

    const origin = window.location.origin;
    if (origin.includes("localhost:5") || origin.includes("127.0.0.1:5")) {
      setAutoChecking(false);
      return;
    }

    apiClient
      .checkHealth(origin)
      .then((health) => {
        setServerUrl(origin);
        apiClient.setServerUrl(origin);
        if (health.isSetupComplete === false) {
          // Server running but no user yet — code auth will auto-create
          setSetupComplete(true);
        } else {
          setSetupComplete(true);
        }
        setAutoChecking(false);
      })
      .catch(() => {
        setAutoChecking(false);
      });
  }, [isAuthenticated, navigate, setServerUrl, setSetupComplete]);

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) return;

    setLoading(true);
    try {
      const deviceName = getDeviceName();
      const tokens = await apiClient.redeemCode(code.trim().toUpperCase(), deviceName);
      setTokens(tokens.accessToken, tokens.refreshToken);
      setSetupComplete(true);
      navigate("/sessions", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to redeem code";
      setError(message);
      setCode("");
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const serverUrl = url.replace(/\/+$/, "");
    if (!serverUrl) return;

    setLoading(true);
    try {
      const health = await apiClient.checkHealth(serverUrl);
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

  // Format code input: uppercase, max 6 chars
  function handleCodeChange(value: string) {
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    setCode(cleaned);
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
              {mode === "code" ? "Enter your access code" : "Connect to your server"}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-surface-1">
          <button
            type="button"
            onClick={() => { setMode("code"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "code"
                ? "bg-accent text-surface-0"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            Access Code
          </button>
          <button
            type="button"
            onClick={() => { setMode("url"); setError(""); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "url"
                ? "bg-accent text-surface-0"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            Server URL
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {/* Code form */}
        {mode === "code" && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Access Code
              </label>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="w-full h-14 px-4 rounded-lg bg-surface-2 border border-border text-text-primary text-2xl font-mono text-center tracking-[0.3em] placeholder:text-text-dimmed placeholder:text-lg placeholder:tracking-normal focus:outline-none focus:border-accent transition-colors"
                placeholder="XXXXXX"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-text-dimmed">
                Get a code from OpenClaw on WhatsApp
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Enter"
              )}
            </button>
          </form>
        )}

        {/* URL form */}
        {mode === "url" && (
          <form onSubmit={handleUrlSubmit} className="space-y-4">
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
        )}
      </div>
    </div>
  );
}

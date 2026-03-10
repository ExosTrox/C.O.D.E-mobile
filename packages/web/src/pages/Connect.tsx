// ── ConnectPage ─────────────────────────────────────────────
// Landing screen: auto-detects server, routes to signup/login.
// Access code is a secondary option for admin-shared codes.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Loader2, Wifi, KeyRound, UserPlus, LogIn } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient } from "../services/api";
import { getDeviceName } from "../lib/device";

// ── Individual code input helpers ──────────────────────────

const CODE_LENGTH = 6;

export function ConnectPage() {
  const navigate = useNavigate();
  const { setServerUrl, setSetupComplete, setTokens, isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<"main" | "code" | "url">("main");
  const [codeChars, setCodeChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const [serverReady, setServerReady] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-detect: if accessed on the server's own domain, mark server ready
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
        setSetupComplete(health.isSetupComplete !== false);
        setServerReady(true);
        setAutoChecking(false);
      })
      .catch(() => {
        setAutoChecking(false);
      });
  }, [isAuthenticated, navigate, setServerUrl, setSetupComplete]);

  const code = codeChars.join("");

  const handleCharChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!cleaned) return;

      const next = [...codeChars];
      if (cleaned.length > 1) {
        const chars = cleaned.slice(0, CODE_LENGTH).split("");
        chars.forEach((ch, i) => {
          if (index + i < CODE_LENGTH) next[index + i] = ch;
        });
        setCodeChars(next);
        const focusIdx = Math.min(index + chars.length, CODE_LENGTH - 1);
        inputRefs.current[focusIdx]?.focus();
        return;
      }

      next[index] = cleaned[0] ?? "";
      setCodeChars(next);

      if (index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [codeChars],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const next = [...codeChars];
        if (codeChars[index]) {
          next[index] = "";
          setCodeChars(next);
        } else if (index > 0) {
          next[index - 1] = "";
          setCodeChars(next);
          inputRefs.current[index - 1]?.focus();
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [codeChars],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);
      if (!pasted) return;
      const next = [...codeChars];
      pasted.split("").forEach((ch, i) => {
        if (i < CODE_LENGTH) next[i] = ch;
      });
      setCodeChars(next);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    },
    [codeChars],
  );

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (code.length < CODE_LENGTH) return;

    setLoading(true);
    try {
      const deviceName = getDeviceName();
      const tokens = await apiClient.redeemCode(code, deviceName);
      setTokens(tokens.accessToken, tokens.refreshToken);
      setSetupComplete(true);
      navigate("/sessions", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to redeem code";
      setError(message);
      setCodeChars(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
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

  if (autoChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-0 connect-bg-animate">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 text-accent animate-spin mx-auto" />
          <p className="text-sm text-text-muted">Connecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 connect-bg-animate relative">
      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="h-20 w-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto icon-glow">
            <Terminal className="h-10 w-10 text-accent" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">CODE Mobile</h1>
            <p className="text-sm text-text-muted">
              Your AI-powered terminal, everywhere.
            </p>
          </div>
        </div>

        {/* Main view: Sign Up / Log In buttons */}
        {mode === "main" && (
          <div className="space-y-4">
            {serverReady ? (
              <>
                {/* Primary actions */}
                <Link
                  to="/signup"
                  className="w-full h-12 rounded-xl bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  Create Account
                </Link>

                <Link
                  to="/login"
                  className="w-full h-12 rounded-xl bg-surface-1/80 backdrop-blur-sm border border-border text-text-primary font-medium text-sm hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>

                {/* Secondary: access code */}
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 text-text-dimmed" style={{ backgroundColor: "transparent" }}>or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => { setMode("code"); setError(""); }}
                  className="w-full h-10 rounded-lg bg-surface-2/50 backdrop-blur-sm text-text-muted font-medium text-xs hover:text-text-secondary hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Have an access code?
                </button>
              </>
            ) : (
              <>
                {/* Server not detected — show URL input */}
                <button
                  type="button"
                  onClick={() => setMode("url")}
                  className="w-full h-12 rounded-xl bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
                >
                  <Wifi className="h-4 w-4" />
                  Connect to Server
                </button>

                <button
                  type="button"
                  onClick={() => { setMode("code"); setError(""); }}
                  className="w-full h-10 rounded-lg bg-surface-2/50 backdrop-blur-sm text-text-muted font-medium text-xs hover:text-text-secondary hover:bg-surface-2 transition-colors flex items-center justify-center gap-2"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Have an access code?
                </button>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {/* Code form */}
        {mode === "code" && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-text-secondary">
                Access Code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="text"
                    autoCapitalize="characters"
                    value={codeChars[i]}
                    onChange={(e) => handleCharChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className="code-box w-12 h-14 rounded-xl bg-surface-2/80 backdrop-blur-sm border-2 border-border text-text-primary text-xl font-mono text-center focus:outline-none"
                    maxLength={1}
                    autoFocus={i === 0}
                    autoComplete="off"
                    spellCheck={false}
                  />
                ))}
              </div>
              <p className="text-xs text-text-dimmed text-center">
                Enter the code shared by your admin
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || code.length < CODE_LENGTH}
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

            <button
              type="button"
              onClick={() => { setMode("main"); setError(""); }}
              className="w-full text-xs text-text-dimmed hover:text-text-muted transition-colors py-1"
            >
              Back
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
                className="w-full h-10 px-3 rounded-lg bg-surface-2/80 backdrop-blur-sm border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
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

            <button
              type="button"
              onClick={() => { setMode("main"); setError(""); }}
              className="w-full text-xs text-text-dimmed hover:text-text-muted transition-colors py-1"
            >
              Back
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-text-dimmed/50 tracking-wide">
        Powered by <span className="text-text-dimmed/70 font-medium">CODE Mobile</span>
      </p>
    </div>
  );
}

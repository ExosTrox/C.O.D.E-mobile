// ── ConnectPage ─────────────────────────────────────────────
// First screen: enter a bootstrap code or connect to a server.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Loader2, Wifi, KeyRound } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient } from "../services/api";
import { getDeviceName } from "../lib/device";

// ── Individual code input helpers ──────────────────────────

const CODE_LENGTH = 6;

export function ConnectPage() {
  const navigate = useNavigate();
  const { setServerUrl, setSetupComplete, setTokens, isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<"code" | "url">("code");
  const [codeChars, setCodeChars] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoChecking, setAutoChecking] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const code = codeChars.join("");

  const handleCharChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!cleaned) return;

      const next = [...codeChars];
      // Handle paste of multiple characters
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

      // Auto-advance
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
      {/* Background gradient animation via CSS */}
      <style>{`
        .connect-bg-animate {
          background: linear-gradient(135deg, #0f0a1e 0%, #1a1035 25%, #0d1b2a 50%, #162447 75%, #0f0a1e 100%);
          background-size: 400% 400%;
          animation: connectGradient 15s ease infinite;
        }
        @keyframes connectGradient {
          0% { background-position: 0% 50%; }
          25% { background-position: 100% 0%; }
          50% { background-position: 100% 100%; }
          75% { background-position: 0% 100%; }
          100% { background-position: 0% 50%; }
        }
        .icon-glow {
          box-shadow: 0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.2), 0 0 90px rgba(139, 92, 246, 0.1);
          animation: iconPulse 3s ease-in-out infinite;
        }
        @keyframes iconPulse {
          0%, 100% { box-shadow: 0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.2); }
          50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6), 0 0 80px rgba(139, 92, 246, 0.3), 0 0 120px rgba(139, 92, 246, 0.15); }
        }
        .code-box {
          transition: all 0.2s ease;
        }
        .code-box:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.15);
        }
      `}</style>

      <div className="w-full max-w-sm space-y-8">
        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="h-20 w-20 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto icon-glow">
            <Terminal className="h-10 w-10 text-accent" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text-primary">CODE Mobile</h1>
            <p className="text-sm text-text-muted">
              {mode === "code" ? "Enter your access code" : "Connect to your server"}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 rounded-lg bg-surface-1/60 backdrop-blur-sm">
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
                Get a code from OpenClaw on WhatsApp
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

// ── ConnectPage ─────────────────────────────────────────────
// Landing screen: auto-detects server, routes to signup/login.
// Access code is a secondary option for admin-shared codes.

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Loader2, Wifi, KeyRound, UserPlus, LogIn, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
      <div className="min-h-screen flex items-center justify-center connect-bg-animate">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-5 w-5 text-accent animate-spin" />
          </div>
          <p className="text-sm text-text-muted font-medium tracking-wide">Connecting</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 connect-bg-animate relative overflow-hidden">
      {/* Decorative grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 rounded-full bg-accent/5 blur-3xl" style={{ animation: "floatSlow 12s ease-in-out infinite" }} />
      <div className="absolute bottom-1/4 -right-20 w-48 h-48 rounded-full bg-purple-500/5 blur-3xl" style={{ animation: "floatSlow 15s ease-in-out infinite 3s" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm space-y-10 relative z-10"
      >
        {/* Branding */}
        <div className="text-center space-y-5">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-accent/20 to-purple-500/10 flex items-center justify-center mx-auto icon-glow border border-accent/10">
              <Terminal className="h-9 w-9 text-accent" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="space-y-2"
          >
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              CODE <span className="text-accent">Mobile</span>
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              AI-powered terminal, anywhere.
            </p>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {/* Main view: Sign Up / Log In buttons */}
          {mode === "main" && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-3"
            >
              {serverReady ? (
                <>
                  <Link
                    to="/signup"
                    className="group w-full h-12 rounded-xl bg-accent text-white font-medium text-sm transition-all flex items-center justify-center gap-2 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create Account
                    <ChevronRight className="h-3.5 w-3.5 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <Link
                    to="/login"
                    className="group w-full h-12 rounded-xl glass-card text-text-primary font-medium text-sm transition-all flex items-center justify-center gap-2 hover:border-accent/20 active:scale-[0.98]"
                  >
                    <LogIn className="h-4 w-4 text-text-secondary" />
                    Sign In
                    <ChevronRight className="h-3.5 w-3.5 opacity-30 group-hover:translate-x-0.5 transition-transform" />
                  </Link>

                  <div className="relative py-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 text-[10px] uppercase tracking-widest text-text-dimmed bg-surface-0">or</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setMode("code"); setError(""); }}
                    className="w-full h-10 rounded-lg text-text-muted font-medium text-xs hover:text-text-secondary transition-all flex items-center justify-center gap-2 hover:bg-surface-2/50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Have an access code?
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("url")}
                    className="w-full h-12 rounded-xl bg-accent text-white font-medium text-sm transition-all flex items-center justify-center gap-2 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-[0.98]"
                  >
                    <Wifi className="h-4 w-4" />
                    Connect to Server
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode("code"); setError(""); }}
                    className="w-full h-10 rounded-lg text-text-muted font-medium text-xs hover:text-text-secondary transition-all flex items-center justify-center gap-2 hover:bg-surface-2/50"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Have an access code?
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* Code form */}
          {mode === "code" && (
            <motion.form
              key="code"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleCodeSubmit}
              className="space-y-5"
            >
              <div className="space-y-3">
                <label className="text-xs font-medium text-text-secondary tracking-wide">
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
                      className="code-box w-11 h-13 rounded-xl bg-surface-2/60 border-2 border-border text-text-primary text-lg font-mono text-center focus:outline-none"
                      maxLength={1}
                      autoFocus={i === 0}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-text-dimmed text-center">
                  Enter the code shared by your admin
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length < CODE_LENGTH}
                className="w-full h-11 rounded-xl bg-accent text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-accent-hover active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Continue"
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode("main"); setError(""); }}
                className="w-full text-xs text-text-dimmed hover:text-text-muted transition-colors py-1"
              >
                Back
              </button>
            </motion.form>
          )}

          {/* URL form */}
          {mode === "url" && (
            <motion.form
              key="url"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              onSubmit={handleUrlSubmit}
              className="space-y-5"
            >
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary tracking-wide">
                  Server URL
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-surface-2/60 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/40 transition-all"
                  placeholder="https://your-server.example.com"
                  required
                  autoFocus
                  autoComplete="url"
                />
                <p className="text-[11px] text-text-dimmed">
                  The address where your CODE Mobile daemon is running
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-accent text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-accent-hover active:scale-[0.98]"
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
            </motion.form>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="rounded-xl bg-error/8 border border-error/15 px-4 py-3 text-sm text-error/90"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <p className="absolute bottom-6 text-[10px] text-text-dimmed/40 tracking-[0.2em] uppercase">
        Code Mobile
      </p>
    </div>
  );
}

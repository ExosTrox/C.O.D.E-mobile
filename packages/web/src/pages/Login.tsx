// ── LoginPage ───────────────────────────────────────────────
// Login: username + password. TOTP shown if server requires it.

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore, getPersistedAuth } from "../stores/auth.store";
import { apiClient, ApiError } from "../services/api";
import { getDeviceName } from "../lib/device";
import { wsClient } from "../services/ws";
import { cn } from "../lib/cn";

export function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, refreshToken, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const totpInputRef = useRef<HTMLInputElement>(null);
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/sessions", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (autoLoginAttempted.current || isAuthenticated) return;
    const token = refreshToken || getPersistedAuth().refreshToken;
    if (!token) return;
    autoLoginAttempted.current = true;

    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 8000);
    apiClient
      .refresh(token)
      .then((tokens) => {
        clearTimeout(timeout);
        setTokens(tokens.accessToken, tokens.refreshToken);
        wsClient.connect(tokens.accessToken);
        navigate("/sessions", { replace: true });
      })
      .catch(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
  }, [refreshToken, isAuthenticated, setTokens, navigate]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const doLogin = useCallback(
    async (pw: string, totp?: string) => {
      setError("");
      setLoading(true);

      try {
        const tokens = await apiClient.login(pw, totp || "", getDeviceName(), username || undefined);
        setTokens(tokens.accessToken, tokens.refreshToken);

        if (!rememberDevice) {
          window.addEventListener(
            "beforeunload",
            () => { useAuthStore.getState().logout(); },
            { once: true },
          );
        }

        wsClient.connect(tokens.accessToken);
        navigate("/sessions", { replace: true });
      } catch (err) {
        if (err instanceof ApiError && err.code === "TOTP_REQUIRED") {
          setNeedsTotp(true);
          setLoading(false);
          setTimeout(() => totpInputRef.current?.focus(), 100);
          return;
        }

        triggerShake();
        setTotpCode("");

        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Connection failed. Is the server running?");
        }
      } finally {
        setLoading(false);
      }
    },
    [username, rememberDevice, setTokens, navigate, triggerShake],
  );

  function handleTotpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "");
    setTotpCode(value);

    if (value.length === 6 && password) {
      void doLogin(password, value);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doLogin(password, totpCode || undefined);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-0 relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-3xl"
        style={{ background: `rgba(var(--accent-rgb), 0.03)` }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "w-full max-w-sm space-y-8 relative z-10",
          shaking && "animate-[shake_0.5s_ease-in-out]",
        )}
      >
        {/* Back */}
        <Link
          to="/connect"
          className="inline-flex items-center gap-1.5 text-xs text-text-dimmed hover:text-text-muted transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </Link>

        {/* Branding */}
        <div className="space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/15 via-accent/8 to-transparent flex items-center justify-center border border-accent/10">
            <Terminal className="h-6 w-6 text-accent" />
          </div>
          <div className="space-y-1 pt-1">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Welcome back</h1>
            <p className="text-sm text-text-muted">Sign in to your terminal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-error/8 border border-error/15 px-4 py-3 text-sm text-error/90"
            >
              {error}
            </motion.div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-surface-2/50 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/40 transition-all"
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-surface-2/50 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/40 transition-all"
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-dimmed hover:text-text-muted transition-colors rounded-lg hover:bg-surface-3/50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* TOTP */}
          {needsTotp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-1.5"
            >
              <label className="text-xs font-semibold text-text-secondary">
                Two-Factor Code
              </label>
              <input
                ref={totpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={handleTotpChange}
                className="w-full h-12 px-4 rounded-xl bg-surface-2/50 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/40 transition-all font-mono tracking-[0.3em] text-center"
                placeholder="000000"
                autoComplete="one-time-code"
              />
              <p className="text-[11px] text-text-dimmed">
                Enter the 6-digit code from your authenticator app
              </p>
            </motion.div>
          )}

          {/* Remember device */}
          <label className="flex items-center gap-2.5 cursor-pointer group py-1">
            <div className="relative">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="sr-only peer"
              />
              <div className="h-4.5 w-4.5 rounded-md border border-border bg-surface-2/50 peer-checked:bg-accent peer-checked:border-accent transition-all flex items-center justify-center">
                {rememberDevice && (
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors">Remember this device</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {/* Links */}
        <div className="text-center space-y-2.5 pt-2">
          <p>
            <Link
              to="/signup"
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              Don&apos;t have an account? <span className="text-accent font-medium">Sign up</span>
            </Link>
          </p>
          <p>
            <Link
              to="/connect"
              className="text-xs text-text-dimmed hover:text-text-muted transition-colors"
            >
              Connect to a different server
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

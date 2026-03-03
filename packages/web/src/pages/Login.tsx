// ── LoginPage ───────────────────────────────────────────────
// Returning user login with TOTP, shake animation, remember device.

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient, ApiError } from "../services/api";
import { getDeviceName } from "../lib/device";
import { wsClient } from "../services/ws";
import { cn } from "../lib/cn";

export function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, refreshToken, isAuthenticated } = useAuthStore();

  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const totpInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const autoLoginAttempted = useRef(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/sessions", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Auto-login with refresh token if device was remembered
  useEffect(() => {
    if (autoLoginAttempted.current || !refreshToken || isAuthenticated) return;
    autoLoginAttempted.current = true;

    setLoading(true);
    apiClient
      .refresh(refreshToken)
      .then((tokens) => {
        setTokens(tokens.accessToken, tokens.refreshToken);
        wsClient.connect(tokens.accessToken);
        navigate("/sessions", { replace: true });
      })
      .catch(() => {
        // Refresh token expired — user must log in manually
        setLoading(false);
      });
  }, [refreshToken, isAuthenticated, setTokens, navigate]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const doLogin = useCallback(
    async (pw: string, totp: string) => {
      setError("");
      setLoading(true);

      try {
        const tokens = await apiClient.login(pw, totp, getDeviceName());

        setTokens(tokens.accessToken, tokens.refreshToken);

        // If not remembering, clear refresh token on tab close
        if (!rememberDevice) {
          window.addEventListener(
            "beforeunload",
            () => {
              useAuthStore.getState().logout();
            },
            { once: true },
          );
        }

        wsClient.connect(tokens.accessToken);
        navigate("/sessions", { replace: true });
      } catch (err) {
        triggerShake();
        setTotpCode("");
        totpInputRef.current?.focus();

        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Connection failed. Is the server running?");
        }
      } finally {
        setLoading(false);
      }
    },
    [rememberDevice, setTokens, navigate, triggerShake],
  );

  // Auto-submit when TOTP reaches 6 digits
  function handleTotpChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value.replace(/\D/g, "");
    setTotpCode(value);

    if (value.length === 6 && password) {
      void doLogin(password, value);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void doLogin(password, totpCode);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div
        className={cn(
          "w-full max-w-sm space-y-8",
          shaking && "animate-[shake_0.5s_ease-in-out]",
        )}
      >
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <Terminal className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">CODE Mobile</h1>
          <p className="text-sm text-text-muted">Sign in to your terminal</p>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 pr-10 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
                placeholder="Enter password"
                required
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* TOTP */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              TOTP Code
            </label>
            <input
              ref={totpInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={handleTotpChange}
              className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors font-mono tracking-widest text-center"
              placeholder="000000"
              required
              autoComplete="one-time-code"
            />
          </div>

          {/* Remember device */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface-2 text-accent focus:ring-accent focus:ring-offset-0"
            />
            <span className="text-xs text-text-muted">Remember this device</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        {/* Link to connect page */}
        <p className="text-center">
          <Link
            to="/connect"
            className="text-xs text-text-dimmed hover:text-text-muted transition-colors"
          >
            Connect to a different server
          </Link>
        </p>
      </div>
    </div>
  );
}

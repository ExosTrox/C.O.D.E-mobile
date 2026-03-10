// ── SignupPage ──────────────────────────────────────────────
// Self-service account creation.

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient, ApiError } from "../services/api";
import { getDeviceName } from "../lib/device";
import { wsClient } from "../services/ws";
import { cn } from "../lib/cn";

export function SignupPage() {
  const navigate = useNavigate();
  const { setTokens, isAuthenticated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/sessions", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }

    setLoading(true);

    try {
      const result = await apiClient.signup(username, password, getDeviceName());
      setTokens(result.accessToken, result.refreshToken);
      wsClient.connect(result.accessToken);
      navigate("/sessions", { replace: true });
    } catch (err) {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);

      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Connection failed. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-xl font-bold text-text-primary">Create Account</h1>
          <p className="text-sm text-text-muted">Sign up for CODE Mobile</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
              placeholder="Choose a username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              autoComplete="username"
              autoFocus
            />
            <p className="text-[10px] text-text-dimmed">3-30 characters, letters, numbers, hyphens, underscores</p>
          </div>

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
                placeholder="Create a password"
                required
                minLength={8}
                autoComplete="new-password"
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

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        {/* Links */}
        <div className="text-center space-y-2">
          <p>
            <Link
              to="/login"
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Already have an account? Sign in
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
      </div>
    </div>
  );
}

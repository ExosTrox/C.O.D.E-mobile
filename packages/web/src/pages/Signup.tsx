// ── SignupPage ──────────────────────────────────────────────
// Self-service account creation.

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Terminal, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
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

  const getStrength = (pw: string): { level: number; label: string; color: string } => {
    if (pw.length === 0) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { level: 1, label: "Weak", color: "bg-error" };
    if (score <= 2) return { level: 2, label: "Fair", color: "bg-warning" };
    if (score <= 3) return { level: 3, label: "Good", color: "bg-info" };
    return { level: 4, label: "Strong", color: "bg-success" };
  };

  const strength = getStrength(password);

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
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface-0 relative overflow-hidden">
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
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Create account</h1>
            <p className="text-sm text-text-muted">Get started with CODE Mobile</p>
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
              placeholder="Choose a username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
              autoComplete="username"
              autoFocus
            />
            <p className="text-[10px] text-text-dimmed">Letters, numbers, hyphens, underscores</p>
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
                placeholder="Create a password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-text-dimmed hover:text-text-muted transition-colors rounded-lg hover:bg-surface-3/50"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all duration-300",
                        level <= strength.level ? strength.color : "bg-surface-3",
                      )}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-text-dimmed">{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Confirm Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={cn(
                "w-full h-12 px-4 rounded-xl bg-surface-2/50 border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none transition-all",
                confirmPassword && confirmPassword !== password
                  ? "border-error/40 focus:border-error/60"
                  : "border-border focus:border-accent/40",
              )}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-accent text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.97]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="text-center space-y-2.5 pt-2">
          <p>
            <Link
              to="/login"
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              Already have an account? <span className="text-accent font-medium">Sign in</span>
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

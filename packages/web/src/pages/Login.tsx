import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient, ApiError } from "../services/api";
import { getDeviceName } from "../lib/device";

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tokens = await apiClient.login(
        password,
        totpCode,
        getDeviceName(),
      );

      setTokens(tokens.accessToken, tokens.refreshToken);
      navigate("/terminal", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Connection failed. Is the daemon running?");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <Terminal className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">CODE Mobile</h1>
          <p className="text-sm text-text-muted">Sign in to your terminal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

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
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">
              TOTP Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors font-mono tracking-widest text-center"
              placeholder="000000"
              required
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

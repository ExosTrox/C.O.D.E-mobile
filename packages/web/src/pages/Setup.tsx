// ── SetupPage ───────────────────────────────────────────────
// First-time setup wizard: token → credentials → 2FA.

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { apiClient, ApiError } from "../services/api";
import { getDeviceId, getDeviceName } from "../lib/device";
import { cn } from "../lib/cn";

// ── Types ───────────────────────────────────────────────────

type Step = 1 | 2 | 3;

// ── Password strength ───────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z\d]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-error" };
  if (score <= 2) return { score, label: "Fair", color: "bg-warning" };
  if (score <= 3) return { score, label: "Good", color: "bg-info" };
  return { score, label: "Strong", color: "bg-success" };
}

// ── Component ───────────────────────────────────────────────

export function SetupPage() {
  const navigate = useNavigate();
  const { setTokens, setSetupComplete } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [bootstrapToken, setBootstrapToken] = useState("");

  // Step 2
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 3
  const [userId, setUserId] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Focus TOTP input on step 3
  useEffect(() => {
    if (step === 3) {
      totpInputRef.current?.focus();
    }
  }, [step]);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = password === confirmPassword;

  // ── Step 1: Validate bootstrap token ──────────────────────

  function handleTokenStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!bootstrapToken.trim()) {
      setError("Please enter the bootstrap token");
      return;
    }

    // Token is validated in step 2 along with credentials
    setStep(2);
  }

  // ── Step 2: Create account ────────────────────────────────

  async function handleCredentialsStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.setup(bootstrapToken, username, password);
      setUserId(res.userId);
      setQrDataUrl(res.totp.qrCodeDataUrl);
      setStep(3);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "UNAUTHORIZED" || err.status === 401) {
          setStep(1);
          setError("Invalid bootstrap token. Check your server terminal.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Connection failed. Is the server running?");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Verify TOTP ───────────────────────────────────

  async function handleTotpStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (totpCode.length !== 6) {
      setError("Enter a 6-digit code");
      return;
    }

    setLoading(true);

    try {
      const tokens = await apiClient.verifyTotp(
        userId,
        totpCode,
        getDeviceId(),
        getDeviceName(),
      );

      setTokens(tokens.accessToken, tokens.refreshToken);
      setSetupComplete(true);
      navigate("/sessions", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Verification failed");
      }
      setTotpCode("");
    } finally {
      setLoading(false);
    }
  }

  // ── Step labels ───────────────────────────────────────────

  const STEPS = [
    { num: 1 as const, label: "Token" },
    { num: 2 as const, label: "Account" },
    { num: 3 as const, label: "2FA" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <Terminal className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">
            Welcome to CODE Mobile
          </h1>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                    step > s.num
                      ? "bg-success text-surface-0"
                      : step === s.num
                        ? "bg-accent text-surface-0"
                        : "bg-surface-2 text-text-dimmed",
                  )}
                >
                  {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium hidden sm:block",
                    step >= s.num ? "text-text-secondary" : "text-text-dimmed",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 rounded-full",
                    step > s.num ? "bg-success" : "bg-surface-3",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {/* Step 1: Bootstrap Token */}
        {step === 1 && (
          <form onSubmit={handleTokenStep} className="space-y-4">
            <p className="text-sm text-text-muted text-center">
              Enter the token shown in your server&apos;s terminal
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Bootstrap Token
              </label>
              <input
                type="text"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm font-mono placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors text-center tracking-wider"
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                required
                autoFocus
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              Next
            </button>
          </form>
        )}

        {/* Step 2: Create Account */}
        {step === 2 && (
          <form onSubmit={handleCredentialsStep} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
                placeholder="admin"
                required
                autoComplete="username"
              />
            </div>

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
                  placeholder="At least 8 characters"
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

              {/* Password strength */}
              {password.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i <= passwordStrength.score
                            ? passwordStrength.color
                            : "bg-surface-3",
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn("text-xs", passwordStrength.color.replace("bg-", "text-"))}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={cn(
                  "w-full h-10 px-3 rounded-lg bg-surface-2 border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none transition-colors",
                  confirmPassword && !passwordsMatch
                    ? "border-error focus:border-error"
                    : "border-border focus:border-accent",
                )}
                placeholder="Repeat password"
                required
                autoComplete="new-password"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-error">Passwords do not match</p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="h-10 px-4 rounded-lg bg-surface-2 text-text-secondary text-sm font-medium hover:bg-surface-3 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !passwordsMatch || password.length < 8}
                className="flex-1 h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Next"
                )}
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Set up 2FA */}
        {step === 3 && (
          <form onSubmit={handleTotpStep} className="space-y-4">
            <p className="text-sm text-text-muted text-center">
              Scan with your authenticator app
            </p>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-3">
                  <img
                    src={qrDataUrl}
                    alt="TOTP QR Code"
                    className="h-48 w-48"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-text-dimmed text-center">
              Google Authenticator, Authy, 1Password, or any TOTP app
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Verification Code
              </label>
              <input
                ref={totpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                className="w-full h-12 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-lg placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors font-mono tracking-[0.5em] text-center"
                placeholder="000000"
                required
                autoComplete="one-time-code"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStep(2); setError(""); }}
                className="h-10 px-4 rounded-lg bg-surface-2 text-text-secondary text-sm font-medium hover:bg-surface-3 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || totpCode.length !== 6}
                className="flex-1 h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

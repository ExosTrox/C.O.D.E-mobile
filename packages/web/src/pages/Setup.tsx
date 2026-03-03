import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Terminal, Copy, Check } from "lucide-react";
import { useAuthStore } from "../stores/auth.store";
import { api, ApiError } from "../services/api";

type Step = "credentials" | "totp" | "done";

export function SetupPage() {
  const navigate = useNavigate();
  const { setTokens, setSetupComplete } = useAuthStore();

  const [step, setStep] = useState<Step>("credentials");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [_totpUri, setTotpUri] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post<{
        totpUri: string;
        totpSecret: string;
      }>("/auth/setup", {
        bootstrapToken,
        username,
        password,
      });

      setTotpUri(res.totpUri);
      setTotpSecret(res.totpSecret);
      setStep("totp");
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

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
      }>("/auth/setup/verify-totp", {
        username,
        totpCode,
        deviceId: getDeviceId(),
        deviceName: navigator.userAgent.slice(0, 64),
      });

      setTokens(res.accessToken, res.refreshToken);
      setSetupComplete(true);
      setStep("done");
      setTimeout(() => navigate("/terminal", { replace: true }), 1500);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Verification failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    await navigator.clipboard.writeText(totpSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-0">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto">
            <Terminal className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">
            Welcome to CODE Mobile
          </h1>
          <p className="text-sm text-text-muted">
            {step === "credentials" && "Set up your account to get started"}
            {step === "totp" && "Configure two-factor authentication"}
            {step === "done" && "You're all set!"}
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2 text-sm text-error">
            {error}
          </div>
        )}

        {step === "credentials" && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Bootstrap Token
              </label>
              <input
                type="text"
                value={bootstrapToken}
                onChange={(e) => setBootstrapToken(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm font-mono placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                required
              />
              <p className="text-xs text-text-dimmed">
                Find this in the daemon console output
              </p>
            </div>

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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Setting up..." : "Continue"}
            </button>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleVerifyTotp} className="space-y-4">
            <div className="rounded-lg bg-surface-2 border border-border p-4 space-y-3">
              <p className="text-xs text-text-secondary">
                Scan this URI in your authenticator app, or copy the secret:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-accent bg-surface-0 px-2 py-1.5 rounded font-mono break-all">
                  {totpSecret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="p-1.5 rounded hover:bg-surface-3 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">
                Verification Code
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
              {loading ? "Verifying..." : "Verify & Complete"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-success/20 flex items-center justify-center mx-auto">
              <Check className="h-6 w-6 text-success" />
            </div>
            <p className="text-sm text-text-secondary">
              Redirecting to terminal...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDeviceId(): string {
  const key = "code-mobile-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

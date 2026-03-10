// ── NewSessionModal ─────────────────────────────────────────
// Bottom-sheet (mobile) / centered modal (desktop) for creating sessions.

import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertTriangle, Loader2, Monitor } from "lucide-react";
import { toast } from "sonner";
import type { ProviderId, ProviderConfig } from "@code-mobile/core";
import { useProviders } from "../../hooks/use-providers";
import { useApiKeys } from "../../hooks/use-api-keys";
import { useCreateSession } from "../../hooks/use-sessions";
import { ApiError, apiClient } from "../../services/api";
import { cn } from "../../lib/cn";

// ── Props ───────────────────────────────────────────────────

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Provider card colors ────────────────────────────────────

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  "claude-code": { bg: "bg-amber-500/8", text: "text-amber-400", border: "border-amber-500/20", gradient: "from-amber-500/15 to-amber-600/5" },
  "openai-codex": { bg: "bg-emerald-500/8", text: "text-emerald-400", border: "border-emerald-500/20", gradient: "from-emerald-500/15 to-emerald-600/5" },
  "gemini-cli": { bg: "bg-blue-500/8", text: "text-blue-400", border: "border-blue-500/20", gradient: "from-blue-500/15 to-blue-600/5" },
  deepseek: { bg: "bg-indigo-500/8", text: "text-indigo-400", border: "border-indigo-500/20", gradient: "from-indigo-500/15 to-indigo-600/5" },
  openclaw: { bg: "bg-pink-500/8", text: "text-pink-400", border: "border-pink-500/20", gradient: "from-pink-500/15 to-pink-600/5" },
  shell: { bg: "bg-cyan-500/8", text: "text-cyan-400", border: "border-cyan-500/20", gradient: "from-cyan-500/15 to-cyan-600/5" },
};

// ── Random name generator ───────────────────────────────────

function randomSessionName(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `session-${suffix}`;
}

// ── Component ───────────────────────────────────────────────

export function NewSessionModal({ open, onClose }: NewSessionModalProps) {
  const navigate = useNavigate();
  const { data: providers } = useProviders();
  const { data: apiKeys } = useApiKeys();
  const createSession = useCreateSession();

  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [workDir, setWorkDir] = useState("~/projects");
  const [placeholder] = useState(randomSessionName);
  const [machinePaired, setMachinePaired] = useState<boolean | null>(null);
  const [checkingMachine, setCheckingMachine] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedProvider(null);
      setSelectedModel("");
      setSessionName("");
      setWorkDir("~/projects");
      setCheckingMachine(true);
      apiClient.getMachineStatus()
        .then((status) => setMachinePaired(status.paired))
        .catch(() => setMachinePaired(false))
        .finally(() => setCheckingMachine(false));
    }
  }, [open]);

  useEffect(() => {
    if (!selectedProvider || !providers) return;
    const p = providers.find((p) => p.id === selectedProvider);
    if (p) {
      setSelectedModel(p.defaultModel);
    }
  }, [selectedProvider, providers]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const hasApiKey = useCallback(
    (providerId: string) => {
      if (!apiKeys) return false;
      return apiKeys.some((k) => k.providerId === providerId);
    },
    [apiKeys],
  );

  const getProviderStatus = useCallback(
    (provider: ProviderConfig): "ready" | "needs-key" | "unavailable" => {
      if (provider.requiresApiKey && !hasApiKey(provider.id)) return "needs-key";
      return "ready";
    },
    [hasApiKey],
  );

  const selectedProviderConfig = providers?.find((p) => p.id === selectedProvider);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedProvider) return;

      createSession.mutate(
        {
          providerId: selectedProvider,
          model: selectedModel || undefined,
          name: sessionName || placeholder,
          workDir: workDir || undefined,
        },
        {
          onSuccess: (session) => {
            onClose();
            navigate(`/terminal/${session.id}`);
          },
          onError: (err) => {
            if (err instanceof ApiError) {
              toast.error(err.message);
            } else {
              const msg = err instanceof Error ? err.message : "Unknown error";
              toast.error(`Failed to create session: ${msg}`);
            }
          },
        },
      );
    },
    [selectedProvider, selectedModel, sessionName, placeholder, workDir, createSession, onClose, navigate],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={cn(
              "fixed z-[60] bg-surface-1 border border-white/[0.06] shadow-2xl overflow-y-auto",
              "inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh]",
              "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:rounded-2xl md:w-full md:max-w-lg md:max-h-[80vh]",
            )}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-8 h-1 rounded-full bg-surface-3" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-base font-semibold text-text-primary tracking-tight">
                New Session
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-dimmed hover:text-text-muted hover:bg-surface-2/50 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-20 md:pb-5 space-y-5">
              {/* Machine check */}
              {checkingMachine && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
                </div>
              )}

              {!checkingMachine && machinePaired === false && (
                <div className="rounded-xl border border-warning/15 bg-warning/5 p-5 text-center space-y-3">
                  <div className="h-12 w-12 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto border border-warning/10">
                    <Monitor className="h-5 w-5 text-warning" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    No machine paired
                  </h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Pair your computer in Settings to start sessions.
                  </p>
                  <Link
                    to="/settings"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-all active:scale-[0.98]"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    Go to Settings
                  </Link>
                </div>
              )}

              {/* Provider selector */}
              {!checkingMachine && machinePaired !== false && (
              <>
              <div className="space-y-2.5">
                <label className="text-xs font-medium text-text-secondary">
                  Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {providers?.map((p) => {
                    const pStatus = getProviderStatus(p);
                    const colors = PROVIDER_COLORS[p.id] ?? {
                      bg: "bg-surface-2",
                      text: "text-text-secondary",
                      border: "border-white/[0.04]",
                      gradient: "from-surface-3 to-surface-2",
                    };
                    const isSelected = selectedProvider === p.id;
                    const isDisabled = pStatus === "unavailable";

                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedProvider(p.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200",
                          isSelected
                            ? `${colors.bg} ${colors.border} ${colors.text}`
                            : "border-white/[0.04] bg-surface-2/30 hover:bg-surface-2/50 hover:border-white/[0.06]",
                          isDisabled && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        <div className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br border border-white/[0.04]",
                          colors.gradient,
                        )}>
                          <span className={cn("text-sm font-bold", isSelected ? colors.text : "text-text-secondary")}>
                            {p.displayName.charAt(0)}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[11px] font-medium",
                          isSelected ? "text-text-primary" : "text-text-muted",
                        )}>
                          {p.displayName}
                        </span>

                        {/* Status */}
                        <div className="absolute top-1.5 right-1.5">
                          {pStatus === "ready" && (
                            <div className="h-4 w-4 rounded-full bg-success/15 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-success" />
                            </div>
                          )}
                          {pStatus === "needs-key" && (
                            <div className="h-4 w-4 rounded-full bg-warning/15 flex items-center justify-center" title="API key required">
                              <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model */}
              {selectedProviderConfig && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl bg-surface-2/60 border border-white/[0.04] text-text-primary text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                  >
                    {selectedProviderConfig.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Session name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">Session Name</label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-11 px-4 rounded-xl bg-surface-2/60 border border-white/[0.04] text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/30 transition-all"
                />
              </div>

              {/* Working directory */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Working Directory
                  <span className="text-text-dimmed ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={workDir}
                  onChange={(e) => setWorkDir(e.target.value)}
                  placeholder="~/projects"
                  className="w-full h-11 px-4 rounded-xl bg-surface-2/60 border border-white/[0.04] text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent/30 transition-all font-mono"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!selectedProvider || createSession.isPending}
                className="w-full h-11 rounded-xl bg-accent text-white font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/15 active:scale-[0.98]"
              >
                {createSession.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Starting&hellip;</span>
                  </>
                ) : (
                  "Start Session"
                )}
              </button>
              </>
              )}
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── NewSessionModal ─────────────────────────────────────────
// Bottom-sheet (mobile) / centered modal (desktop) for creating sessions.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProviderId, ProviderConfig } from "@code-mobile/core";
import { useProviders } from "../../hooks/use-providers";
import { useApiKeys } from "../../hooks/use-api-keys";
import { useCreateSession } from "../../hooks/use-sessions";
import { ApiError } from "../../services/api";
import { cn } from "../../lib/cn";

// ── Props ───────────────────────────────────────────────────

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Provider card colors ────────────────────────────────────

const PROVIDER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "claude-code": { bg: "bg-[#d97706]/10", text: "text-[#d97706]", border: "border-[#d97706]/30" },
  "openai-codex": { bg: "bg-[#10b981]/10", text: "text-[#10b981]", border: "border-[#10b981]/30" },
  "gemini-cli": { bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]", border: "border-[#3b82f6]/30" },
  deepseek: { bg: "bg-[#6366f1]/10", text: "text-[#6366f1]", border: "border-[#6366f1]/30" },
  openclaw: { bg: "bg-[#ec4899]/10", text: "text-[#ec4899]", border: "border-[#ec4899]/30" },
  shell: { bg: "bg-[#22d3ee]/10", text: "text-[#22d3ee]", border: "border-[#22d3ee]/30" },
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

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSelectedProvider(null);
      setSelectedModel("");
      setSessionName("");
      setWorkDir("~/projects");
    }
  }, [open]);

  // Auto-select default model when provider changes
  useEffect(() => {
    if (!selectedProvider || !providers) return;
    const p = providers.find((p) => p.id === selectedProvider);
    if (p) {
      setSelectedModel(p.defaultModel);
    }
  }, [selectedProvider, providers]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Check if provider has an API key stored
  const hasApiKey = useCallback(
    (providerId: string) => {
      if (!apiKeys) return false;
      return apiKeys.some((k) => k.providerId === providerId);
    },
    [apiKeys],
  );

  // Get provider status
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
              toast.error("Failed to create session");
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
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal — bottom sheet on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed z-50 bg-surface-1 border border-border shadow-2xl overflow-y-auto",
              // Mobile: bottom sheet
              "inset-x-0 bottom-0 rounded-t-2xl max-h-[85vh] safe-bottom",
              // Desktop: centered modal
              "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:rounded-2xl md:w-full md:max-w-lg md:max-h-[80vh]",
            )}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-8 h-1 rounded-full bg-surface-3" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-base font-semibold text-text-primary">
                New Session
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-5">
              {/* Provider selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">
                  Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {providers?.map((p) => {
                    const pStatus = getProviderStatus(p);
                    const colors = PROVIDER_COLORS[p.id] ?? {
                      bg: "bg-surface-2",
                      text: "text-text-secondary",
                      border: "border-border",
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
                          "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                          isSelected
                            ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ring-current ${colors.text}`
                            : "border-border hover:border-border-hover bg-surface-2 hover:bg-surface-3",
                          isDisabled && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        {/* Provider initial */}
                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", colors.bg)}>
                          <span className={cn("text-sm font-bold", colors.text)}>
                            {p.displayName.charAt(0)}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-text-primary">
                          {p.displayName}
                        </span>

                        {/* Status indicator */}
                        <div className="absolute top-1.5 right-1.5">
                          {pStatus === "ready" && (
                            <div className="h-4 w-4 rounded-full bg-success/20 flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-success" />
                            </div>
                          )}
                          {pStatus === "needs-key" && (
                            <div className="h-4 w-4 rounded-full bg-warning/20 flex items-center justify-center" title="API key required">
                              <AlertTriangle className="h-2.5 w-2.5 text-warning" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Model selector */}
              {selectedProviderConfig && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
                  >
                    {selectedProviderConfig.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Session name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Session Name
                </label>
                <input
                  type="text"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder={placeholder}
                  className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors"
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
                  className="w-full h-10 px-3 rounded-lg bg-surface-2 border border-border text-text-primary text-sm placeholder:text-text-dimmed focus:outline-none focus:border-accent transition-colors font-mono"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!selectedProvider || createSession.isPending}
                className="w-full h-11 rounded-lg bg-accent text-surface-0 font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Providers Page ──────────────────────────────────────────
// Grid of provider cards with status, API key management, model details.

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import type { ProviderConfig } from "@code-mobile/core";
import { PROVIDERS } from "@code-mobile/core";
import { Header } from "../components/layout/Header";
import { Spinner } from "../components/ui/Spinner";
import { ProviderDetail } from "../components/providers/ProviderDetail";
import { useApiKeys } from "../hooks/use-api-keys";
import { useProviders } from "../hooks/use-providers";
import { cn } from "../lib/cn";

// ── Provider colors ────────────────────────────────────────

const PROVIDER_COLORS: Record<string, { color: string; accent: string }> = {
  "claude-code": { color: "#f59e0b", accent: "#d97706" },
  "openai-codex": { color: "#10b981", accent: "#10b981" },
  "gemini-cli": { color: "#3b82f6", accent: "#3b82f6" },
  deepseek: { color: "#6366f1", accent: "#6366f1" },
  openclaw: { color: "#ec4899", accent: "#ec4899" },
};

const DEFAULT_COLOR = { color: "var(--color-accent)", accent: "#7aa2f7" };

// ── Status logic ───────────────────────────────────────────

type ProviderStatus = "ready" | "needs-key" | "not-installed" | "error";

function getProviderStatus(
  provider: ProviderConfig,
  hasApiKey: boolean,
  serverStatus?: string,
): { status: ProviderStatus; badge: { variant: "ready" | "warning" | "muted"; label: string } } {
  if (serverStatus === "not_installed") {
    return { status: "not-installed", badge: { variant: "muted", label: "Not Installed" } };
  }
  if (serverStatus === "needs_key") {
    return { status: "needs-key", badge: { variant: "warning", label: "Needs Key" } };
  }
  if (serverStatus === "ready") {
    return { status: "ready", badge: { variant: "ready", label: "Ready" } };
  }

  if (!provider.requiresApiKey) {
    return { status: "ready", badge: { variant: "ready", label: "Ready" } };
  }
  if (hasApiKey) {
    return { status: "ready", badge: { variant: "ready", label: "Ready" } };
  }
  return { status: "needs-key", badge: { variant: "warning", label: "Needs Key" } };
}

// ── ProviderCard ───────────────────────────────────────────

function ProviderCard({
  provider,
  hasApiKey,
  serverStatus,
  index,
  onClick,
}: {
  provider: ProviderConfig;
  hasApiKey: boolean;
  serverStatus?: string;
  index: number;
  onClick: () => void;
}) {
  const colors = PROVIDER_COLORS[provider.id] ?? DEFAULT_COLOR;
  const { badge } = getProviderStatus(provider, hasApiKey, serverStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <button
        onClick={onClick}
        className="w-full text-left rounded-2xl bg-gradient-to-br from-surface-1/80 to-surface-1/40 border border-white/[0.05] p-4 space-y-3 cursor-pointer card-hover hover:border-white/[0.08] active:scale-[0.98] transition-all duration-200"
      >
        {/* Icon + Status */}
        <div className="flex items-start justify-between">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center provider-icon"
            style={{
              background: `linear-gradient(135deg, ${colors.color}18, ${colors.color}08)`,
              border: `1px solid ${colors.color}20`,
            }}
          >
            <span
              className="text-sm font-bold relative z-10"
              style={{ color: colors.color }}
            >
              {provider.displayName.charAt(0)}
            </span>
          </div>

          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-lg border",
            badge.variant === "ready"
              ? "bg-success/8 text-success border-success/15"
              : badge.variant === "warning"
                ? "bg-warning/8 text-warning border-warning/15"
                : "bg-surface-2/60 text-text-muted border-white/[0.04]",
          )}>
            {badge.variant === "ready" && <Check className="h-2.5 w-2.5" />}
            {badge.variant === "warning" && <AlertTriangle className="h-2.5 w-2.5" />}
            {badge.label}
          </div>
        </div>

        {/* Name */}
        <div>
          <h3 className="text-sm font-bold text-text-primary tracking-tight">{provider.displayName}</h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            {provider.models.length} model{provider.models.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-0.5 w-8 rounded-full opacity-40"
          style={{ backgroundColor: colors.accent }}
        />
      </button>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────

export function ProvidersPage() {
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const { data: serverProviders } = useProviders();
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);

  const providerList = Object.values(PROVIDERS);
  const apiKeyMap = new Set((apiKeys ?? []).map((k) => k.providerId));

  const serverStatusMap = new Map<string, string>();
  if (serverProviders) {
    for (const sp of serverProviders as Array<ProviderConfig & { status: string }>) {
      serverStatusMap.set(sp.id, sp.status);
    }
  }

  const selectedApiKey = selectedProvider
    ? (apiKeys ?? []).find((k) => k.providerId === selectedProvider.id) ?? null
    : null;

  return (
    <>
      <Header title="Providers" />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                AI Providers
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                {providerList.length} providers configured
              </p>
            </div>
            {keysLoading && <Spinner size="sm" className="text-text-muted" />}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {providerList.map((provider, i) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                hasApiKey={apiKeyMap.has(provider.id)}
                serverStatus={serverStatusMap.get(provider.id)}
                index={i}
                onClick={() => setSelectedProvider(provider)}
              />
            ))}
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-surface-1/30 border border-white/[0.04]">
            <HelpCircle className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <p className="text-[11px] text-text-muted leading-relaxed">
              Providers require their CLI tool to be installed on the server.
              API keys are stored encrypted and never leave your server.
            </p>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {selectedProvider && (
        <ProviderDetail
          provider={selectedProvider}
          apiKey={selectedApiKey}
          open={!!selectedProvider}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </>
  );
}

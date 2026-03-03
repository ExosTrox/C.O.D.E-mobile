// ── Providers Page ──────────────────────────────────────────
// Grid of provider cards with status, API key management, model details.

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Box,
  Check,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Cpu,
} from "lucide-react";
import type { ProviderConfig, ProviderId } from "@code-mobile/core";
import { PROVIDERS } from "@code-mobile/core";
import { Header } from "../components/layout/Header";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Spinner } from "../components/ui/Spinner";
import { ProviderDetail } from "../components/providers/ProviderDetail";
import { useApiKeys } from "../hooks/use-api-keys";
import { cn } from "../lib/cn";

// ── Provider colors ────────────────────────────────────────

const PROVIDER_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  "claude-code": { bg: "bg-[#d97706]/10", text: "text-[#d97706]", accent: "#d97706" },
  "openai-codex": { bg: "bg-[#10b981]/10", text: "text-[#10b981]", accent: "#10b981" },
  "gemini-cli": { bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]", accent: "#3b82f6" },
  deepseek: { bg: "bg-[#6366f1]/10", text: "text-[#6366f1]", accent: "#6366f1" },
  openclaw: { bg: "bg-[#ec4899]/10", text: "text-[#ec4899]", accent: "#ec4899" },
};

const DEFAULT_COLOR = { bg: "bg-accent/10", text: "text-accent", accent: "#7aa2f7" };

// ── Status logic ───────────────────────────────────────────

type ProviderStatus = "ready" | "needs-key" | "not-installed" | "error";

function getProviderStatus(
  provider: ProviderConfig,
  hasApiKey: boolean,
): { status: ProviderStatus; badge: { variant: "success" | "warning" | "muted" | "error"; label: string } } {
  // Providers that don't require API keys are always "ready" (install status TBD)
  if (!provider.requiresApiKey) {
    return { status: "ready", badge: { variant: "success", label: "Ready" } };
  }

  if (hasApiKey) {
    return { status: "ready", badge: { variant: "success", label: "Ready" } };
  }

  return { status: "needs-key", badge: { variant: "warning", label: "Needs API Key" } };
}

// ── Provider Icon ──────────────────────────────────────────

function ProviderIcon({ providerId, className }: { providerId: string; className?: string }) {
  const colors = PROVIDER_COLORS[providerId] ?? DEFAULT_COLOR;

  // Use a generic CPU icon with provider-specific coloring
  return (
    <div className={cn("rounded-xl flex items-center justify-center", colors.bg, className)}>
      <Cpu className={cn("h-6 w-6", colors.text)} />
    </div>
  );
}

// ── ProviderCard ───────────────────────────────────────────

function ProviderCard({
  provider,
  hasApiKey,
  index,
  onClick,
}: {
  provider: ProviderConfig;
  hasApiKey: boolean;
  index: number;
  onClick: () => void;
}) {
  const colors = PROVIDER_COLORS[provider.id] ?? DEFAULT_COLOR;
  const { badge } = getProviderStatus(provider, hasApiKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Card interactive onClick={onClick} className="space-y-3">
        {/* Icon + Status */}
        <div className="flex items-start justify-between">
          <ProviderIcon providerId={provider.id} className="h-11 w-11" />
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
        </div>

        {/* Name */}
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{provider.displayName}</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {provider.models.length} model{provider.models.length !== 1 ? "s" : ""} available
          </p>
        </div>

        {/* Bottom accent line */}
        <div
          className="h-0.5 w-8 rounded-full opacity-40"
          style={{ backgroundColor: colors.accent }}
        />
      </Card>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────

export function ProvidersPage() {
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);

  const providerList = Object.values(PROVIDERS);
  const apiKeyMap = new Set((apiKeys ?? []).map((k) => k.providerId));

  const selectedApiKey = selectedProvider
    ? (apiKeys ?? []).find((k) => k.providerId === selectedProvider.id) ?? null
    : null;

  return (
    <>
      <Header title="Providers" />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">AI Providers</h2>
              <p className="text-xs text-text-muted mt-0.5">
                {providerList.length} providers configured
              </p>
            </div>
            {keysLoading && <Spinner size="sm" className="text-text-muted" />}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {providerList.map((provider, i) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                hasApiKey={apiKeyMap.has(provider.id)}
                index={i}
                onClick={() => setSelectedProvider(provider)}
              />
            ))}
          </div>

          {/* Info box */}
          <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-surface-2/50 border border-border">
            <HelpCircle className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted leading-relaxed">
              Providers require their CLI tool to be installed on the server.
              API keys are stored encrypted in the database and never leave your server.
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

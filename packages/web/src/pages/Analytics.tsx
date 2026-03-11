// ── Analytics Page ──────────────────────────────────────────
// Overview cards, provider breakdown bars, usage trend chart.

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Zap,
  DollarSign,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Header } from "../components/layout/Header";
import { Spinner } from "../components/ui/Spinner";
import {
  useAnalyticsOverview,
  useProviderBreakdown,
  useUsageTrend,
} from "../hooks/use-analytics";
import { cn } from "../lib/cn";

// ── Provider colors ─────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  "claude-code": "#f59e0b",
  "openai-codex": "#10b981",
  "gemini-cli": "#3b82f6",
  deepseek: "#6366f1",
  openclaw: "#ec4899",
};

const DEFAULT_COLOR = "#7b93fd";

// ── Helpers ─────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

// ── Stat Card ───────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  index,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl bg-gradient-to-br from-surface-1/80 to-surface-1/40 border border-white/[0.05] p-4 space-y-2.5 card-hover"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-text-primary font-mono tracking-tight">{value}</p>
    </motion.div>
  );
}

// ── Provider Bar Chart ──────────────────────────────────────

function ProviderBars({
  data,
}: {
  data: Array<{
    providerId: string;
    sessionCount: number;
    tokenCount: number;
    costEstimate: number;
  }>;
}) {
  const maxTokens = Math.max(...data.map((d) => d.tokenCount), 1);

  return (
    <div className="space-y-3">
      {data.map((provider) => {
        const color = PROVIDER_COLORS[provider.providerId] ?? DEFAULT_COLOR;
        const pct = (provider.tokenCount / maxTokens) * 100;

        return (
          <div key={provider.providerId} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-semibold capitalize">
                {provider.providerId.replace(/-/g, " ")}
              </span>
              <span className="text-text-muted font-mono text-[11px]">
                {formatTokens(provider.tokenCount)} tokens
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-0/60 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-dimmed">
              <span>{provider.sessionCount} sessions</span>
              <span>{formatCost(provider.costEstimate)}</span>
            </div>
          </div>
        );
      })}

      {data.length === 0 && (
        <p className="text-sm text-text-muted text-center py-4">No provider data yet</p>
      )}
    </div>
  );
}

// ── Usage Trend Chart (SVG) ─────────────────────────────────

function TrendChart({
  data,
}: {
  data: Array<{ timestamp: number; tokens: number; cost: number }>;
}) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-text-muted text-center py-8">
        Not enough data for trend chart
      </p>
    );
  }

  const W = 600;
  const H = 200;
  const PAD = 30;

  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);
  const maxCost = Math.max(...data.map((d) => d.cost), 0.01);

  const tokenPoints = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - (d.tokens / maxTokens) * (H - 2 * PAD);
      return `${x},${y}`;
    })
    .join(" ");

  const costPoints = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
      const y = H - PAD - (d.cost / maxCost) * (H - 2 * PAD);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[400px]" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <line
            key={pct}
            x1={PAD}
            x2={W - PAD}
            y1={H - PAD - pct * (H - 2 * PAD)}
            y2={H - PAD - pct * (H - 2 * PAD)}
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}

        {/* Token line */}
        <polyline
          points={tokenPoints}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Cost line */}
        <polyline
          points={costPoints}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((d, i) => {
          const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
          const y = H - PAD - (d.tokens / maxTokens) * (H - 2 * PAD);
          return <circle key={i} cx={x} cy={y} r="3" fill="var(--color-accent)" />;
        })}
      </svg>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-text-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full bg-accent" />
          <span>Tokens</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-4 rounded-full bg-success" />
          <span>Cost</span>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────

export function AnalyticsPage() {
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(period);
  const { data: providers } = useProviderBreakdown(period);
  const { data: trend } = useUsageTrend(period, period === "24h" ? "hour" : "day");

  return (
    <>
      <Header title="Analytics" />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-5 space-y-5 max-w-2xl mx-auto">
          {/* Period selector */}
          <div className="flex items-center gap-1.5">
            {(["24h", "7d", "30d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200",
                  period === p
                    ? "bg-accent/12 text-accent border border-accent/20 shadow-sm shadow-accent/5"
                    : "text-text-muted hover:text-text-secondary hover:bg-surface-2/40 border border-transparent",
                )}
              >
                {p}
              </button>
            ))}
            {overviewLoading && <Spinner size="sm" className="text-text-muted ml-2" />}
          </div>

          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              label="Sessions"
              value={String(overview?.totalSessions ?? 0)}
              icon={Layers}
              iconColor="bg-accent/10 text-accent"
              index={0}
            />
            <StatCard
              label="Active"
              value={String(overview?.activeSessions ?? 0)}
              icon={Activity}
              iconColor="bg-success/10 text-success"
              index={1}
            />
            <StatCard
              label="Tokens"
              value={formatTokens(overview?.totalTokens ?? 0)}
              icon={Zap}
              iconColor="bg-warning/10 text-warning"
              index={2}
            />
            <StatCard
              label="Cost"
              value={formatCost(overview?.estimatedCost ?? 0)}
              icon={DollarSign}
              iconColor="bg-info/10 text-info"
              index={3}
            />
          </div>

          {/* Provider breakdown */}
          <div className="rounded-2xl bg-gradient-to-br from-surface-1/80 to-surface-1/40 border border-white/[0.05] p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Provider Breakdown
            </h3>
            <ProviderBars data={providers ?? []} />
          </div>

          {/* Usage trend */}
          <div className="rounded-2xl bg-gradient-to-br from-surface-1/80 to-surface-1/40 border border-white/[0.05] p-4 space-y-3">
            <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              Usage Trend
            </h3>
            <TrendChart data={trend ?? []} />
          </div>

          {/* Most used provider */}
          {overview?.mostUsedProvider && (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-1/30 border border-white/[0.04]">
              <TrendingUp className="h-4 w-4 text-accent shrink-0" />
              <p className="text-xs text-text-muted">
                Most used:{" "}
                <span className="text-text-secondary font-semibold capitalize">
                  {overview.mostUsedProvider.replace(/-/g, " ")}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

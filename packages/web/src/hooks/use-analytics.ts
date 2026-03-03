// ── Analytics Hooks ──────────────────────────────────────────

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth.store";

interface AnalyticsOverview {
  totalSessions: number;
  activeSessions: number;
  totalTokens: number;
  estimatedCost: number;
  mostUsedProvider: string | null;
}

interface ProviderBreakdown {
  providerId: string;
  sessionCount: number;
  tokenCount: number;
  costEstimate: number;
}

interface UsageTrendPoint {
  timestamp: number;
  sessions: number;
  tokens: number;
  cost: number;
}

async function fetchJson<T>(url: string, token: string | null): Promise<T> {
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await res.json();
  if (data.success) return data.data;
  throw new Error(data.error?.message ?? "Request failed");
}

export function useAnalyticsOverview(period: string = "7d") {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics", "overview", period],
    queryFn: () =>
      fetchJson(`${serverUrl}/api/v1/analytics/overview?period=${period}`, token),
    refetchInterval: 30_000,
  });
}

export function useProviderBreakdown(period: string = "30d") {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<ProviderBreakdown[]>({
    queryKey: ["analytics", "providers", period],
    queryFn: () =>
      fetchJson(`${serverUrl}/api/v1/analytics/providers?period=${period}`, token),
    refetchInterval: 60_000,
  });
}

export function useUsageTrend(period: string = "7d", granularity: string = "day") {
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<UsageTrendPoint[]>({
    queryKey: ["analytics", "usage", period, granularity],
    queryFn: () =>
      fetchJson(
        `${serverUrl}/api/v1/analytics/usage?period=${period}&granularity=${granularity}`,
        token,
      ),
    refetchInterval: 60_000,
  });
}

import { useQuery } from "@tanstack/react-query";
import type { ProviderId } from "@code-mobile/core";
import { apiClient } from "../services/api";

const PROVIDERS_KEY = ["providers"] as const;

export function useProviders() {
  return useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => apiClient.listProviders(),
    staleTime: 60_000,
  });
}

export function useProvider(id: ProviderId | null) {
  return useQuery({
    queryKey: [...PROVIDERS_KEY, id],
    queryFn: () => apiClient.getProvider(id ?? ("" as ProviderId)),
    enabled: !!id,
  });
}

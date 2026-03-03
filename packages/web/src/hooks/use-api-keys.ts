import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProviderId } from "@code-mobile/core";
import { apiClient } from "../services/api";

const API_KEYS_KEY = ["api-keys"] as const;

export function useApiKeys() {
  return useQuery({
    queryKey: API_KEYS_KEY,
    queryFn: () => apiClient.listApiKeys(),
  });
}

export function useStoreApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ providerId, apiKey }: { providerId: ProviderId; apiKey: string }) =>
      apiClient.storeApiKey(providerId, apiKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: API_KEYS_KEY });
    },
  });
}

export function useValidateApiKey() {
  return useMutation({
    mutationFn: ({ providerId, apiKey }: { providerId: ProviderId; apiKey: string }) =>
      apiClient.validateApiKey(providerId, apiKey),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SessionCreateOptions, SessionStatus, ProviderId } from "@code-mobile/core";
import { apiClient } from "../services/api";

const SESSIONS_KEY = ["sessions"] as const;

export function useSessions(status?: SessionStatus, provider?: ProviderId) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, { status, provider }],
    queryFn: () => apiClient.listSessions(status, provider),
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, id],
    queryFn: () => apiClient.getSession(id ?? ""),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: SessionCreateOptions) => apiClient.createSession(options),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.stopSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

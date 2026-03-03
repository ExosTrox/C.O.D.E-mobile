// ── Session Hooks ───────────────────────────────────────────
// TanStack Query wrappers for session CRUD with optimistic updates.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Session, SessionCreateOptions, SessionStatus, ProviderId } from "@code-mobile/core";
import { apiClient } from "../services/api";

const SESSIONS_KEY = ["sessions"] as const;

// ── Queries ─────────────────────────────────────────────────

export function useSessions(status?: SessionStatus, provider?: ProviderId) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, { status, provider }],
    queryFn: () => apiClient.listSessions(status, provider),
    refetchInterval: 5_000,
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: [...SESSIONS_KEY, id],
    queryFn: () => apiClient.getSession(id ?? ""),
    enabled: !!id,
  });
}

// ── Mutations ───────────────────────────────────────────────

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: SessionCreateOptions) => apiClient.createSession(options),
    onMutate: async (options) => {
      // Cancel ongoing refetches
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });

      // Snapshot current data
      const previous = queryClient.getQueriesData<Session[]>({ queryKey: SESSIONS_KEY });

      // Optimistically add a placeholder session
      queryClient.setQueriesData<Session[]>({ queryKey: SESSIONS_KEY }, (old) => {
        if (!old) return old;
        const placeholder: Session = {
          id: `temp-${Date.now()}` as Session["id"],
          name: options.name ?? "New session",
          providerId: options.providerId,
          model: options.model ?? "",
          status: "starting",
          createdAt: new Date(),
          updatedAt: new Date(),
          pid: null,
          tmuxSessionName: "",
          workDir: options.workDir ?? "~/projects",
        };
        return [placeholder, ...old];
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useStopSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.stopSession(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueriesData<Session[]>({ queryKey: SESSIONS_KEY });

      // Optimistically mark session as stopped
      queryClient.setQueriesData<Session[]>({ queryKey: SESSIONS_KEY }, (old) => {
        if (!old) return old;
        return old.map((s) => (s.id === id ? { ...s, status: "stopped" as const } : s));
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.stopSession(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previous = queryClient.getQueriesData<Session[]>({ queryKey: SESSIONS_KEY });

      // Optimistically remove from list
      queryClient.setQueriesData<Session[]>({ queryKey: SESSIONS_KEY }, (old) => {
        if (!old) return old;
        return old.filter((s) => s.id !== id);
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

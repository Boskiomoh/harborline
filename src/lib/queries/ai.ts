"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api/client";
import {
  aiDraftResponseSchema,
  aiSummaryResponseSchema,
  aiTriageResponseSchema,
  apiErrorSchema,
  type AiSource,
} from "@/lib/api/schemas";
import { qk } from "@/lib/query/keys";

// ---- Draft (streaming) --------------------------------------------------------------------------

export type DraftState = { text: string; sources: AiSource[] | null };

const EMPTY_DRAFT: DraftState = { text: "", sources: null };

/**
 * Streams a suggested reply. `draft` fills in as the text arrives: `sources` lands first (from
 * the response's leading JSON line), then `text` grows chunk by chunk. `mutate()` restarts from
 * empty; `stop()` aborts a stream mid-way and keeps what has arrived. Nothing here sends a reply.
 */
export function useDraftReplyMutation(ticketId: number) {
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const mutation = useMutation({
    mutationFn: async (): Promise<DraftState> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setDraft(EMPTY_DRAFT);

      const response = await fetch(`/api/tickets/${ticketId}/ai/draft`, { method: "POST", signal: controller.signal });
      if (!response.ok || !response.body) {
        const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
        throw new ApiError(response.status, parsed.success ? parsed.data : { error: "generic" });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: AiSource[] | null = null;
      let text = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (sources === null) {
            buffer += chunk;
            const newline = buffer.indexOf("\n");
            if (newline === -1) continue;
            sources = aiDraftResponseSchema.parse(JSON.parse(buffer.slice(0, newline))).sources;
            text = buffer.slice(newline + 1);
          } else {
            text += chunk;
          }
          setDraft({ text, sources });
        }
      } catch (error) {
        // Stopped by the agent: keep what arrived rather than treating it as a failure.
        if (controller.signal.aborted) return { text, sources: sources ?? [] };
        throw error;
      }

      const final = { text: text.trim(), sources: sources ?? [] };
      setDraft(final);
      return final;
    },
  });

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const { reset: resetMutation } = mutation;
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDraft(EMPTY_DRAFT);
    resetMutation();
  }, [resetMutation]);

  return { ...mutation, draft, stop, reset };
}

// ---- Triage -------------------------------------------------------------------------------------

/**
 * One suggestion per ticket per session: never refetched on its own (`staleTime: Infinity`) and
 * never retried, since every request spends the viewer's daily AI allowance.
 */
export function useTriageSuggestionQuery(ticketId: number, { enabled }: { enabled: boolean }) {
  return useQuery({
    queryKey: qk.aiTriage(ticketId),
    queryFn: () => apiFetch(`/api/tickets/${ticketId}/ai/triage`, aiTriageResponseSchema, { method: "POST" }),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// ---- Summary ------------------------------------------------------------------------------------

export function useSummaryMutation(ticketId: number) {
  return useMutation({
    mutationFn: () => apiFetch(`/api/tickets/${ticketId}/ai/summary`, aiSummaryResponseSchema, { method: "POST" }),
  });
}

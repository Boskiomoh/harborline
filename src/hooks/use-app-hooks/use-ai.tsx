"use client";

import { apiInstance } from "@/lib/api/instance";
import { useQuery } from "@tanstack/react-query";

// One suggestion per ticket per session: never refetched on its own and never
// retried, since every request spends the viewer's daily AI allowance.
const useTriageSuggestion = (arg: { ticketId: number; enabled: boolean }) => {
  const { ticketId, enabled } = arg;

  return useQuery({
    queryKey: ["ai-triage", ticketId],
    queryFn: async () => {
      try {
        const res = await apiInstance.post(
          `/api/tickets/${ticketId}/ai/triage`,
        );

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
    enabled: !!ticketId && enabled,
  });
};

export { useTriageSuggestion };

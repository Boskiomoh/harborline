"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { cannedResponsesSchema, inboxTicketsSchema, slaTargetsSchema, staffListSchema } from "@/lib/api/schemas";
import { qk } from "@/lib/query/keys";
import type { InboxTicket } from "@/lib/inbox";

export function useInboxQuery() {
  return useQuery({
    queryKey: qk.inbox(),
    queryFn: () => apiFetch("/api/inbox", inboxTicketsSchema),
  });
}

export function useStaffQuery() {
  return useQuery({
    queryKey: qk.staff(),
    queryFn: () => apiFetch("/api/staff", staffListSchema),
  });
}

export function useCannedResponsesQuery() {
  return useQuery({
    queryKey: qk.cannedResponses(),
    queryFn: () => apiFetch("/api/canned-responses", cannedResponsesSchema),
  });
}

export function useSlaPoliciesQuery() {
  return useQuery({
    queryKey: qk.slaPolicies(),
    queryFn: () => apiFetch("/api/sla-policies", slaTargetsSchema),
  });
}

/** Shared by the inbox Realtime subscription and ticket mutations that also touch the list. */
export function patchInboxList(queryClient: QueryClient, updater: (prev: InboxTicket[]) => InboxTicket[]) {
  queryClient.setQueryData<InboxTicket[]>(qk.inbox(), (prev) => (prev ? updater(prev) : prev));
}

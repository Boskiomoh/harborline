"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import {
  createTicketInputSchema,
  createTicketResultSchema,
  myTicketsSchema,
  okSchema,
  postMessageInputSchema,
  recordAttachmentInputSchema,
  ticketDetailSchema,
  ticketMessageSchema,
  updateTicketInputSchema,
  type CreateTicketInput,
  type PostMessageInput,
  type RecordAttachmentInput,
  type UpdateTicketInput,
} from "@/lib/api/schemas";
import { qk } from "@/lib/query/keys";
import type { People, TicketCore, TicketDetail, TicketEvent, TicketMessage } from "@/lib/tickets";
import { patchInboxList } from "./inbox";

// ---- Reads ------------------------------------------------------------------

export function useMyTicketsQuery() {
  return useQuery({
    queryKey: qk.myTickets(),
    queryFn: () => apiFetch("/api/tickets", myTicketsSchema),
  });
}

export function useTicketDetailQuery(id: number) {
  return useQuery({
    queryKey: qk.ticket(id),
    queryFn: () => apiFetch(`/api/tickets/${id}`, ticketDetailSchema),
  });
}

// ---- Cache patches (shared by mutations below and the Realtime subscriptions) ----

function patchTicketDetail(queryClient: QueryClient, id: number, updater: (prev: TicketDetail) => TicketDetail) {
  queryClient.setQueryData<TicketDetail>(qk.ticket(id), (prev) => (prev ? updater(prev) : prev));
}

export function appendTicketMessage(queryClient: QueryClient, id: number, message: TicketMessage) {
  patchTicketDetail(queryClient, id, (prev) =>
    prev.messages.some((m) => m.id === message.id) ? prev : { ...prev, messages: [...prev.messages, message] },
  );
}

export function patchTicketCore(queryClient: QueryClient, id: number, patch: Partial<TicketCore>) {
  patchTicketDetail(queryClient, id, (prev) => ({ ...prev, ticket: { ...prev.ticket, ...patch } }));
}

export function appendTicketEvent(queryClient: QueryClient, id: number, event: TicketEvent) {
  patchTicketDetail(queryClient, id, (prev) =>
    prev.events.some((e) => e.id === event.id) ? prev : { ...prev, events: [...prev.events, event] },
  );
}

export function mergeTicketPeople(queryClient: QueryClient, id: number, people: People) {
  patchTicketDetail(queryClient, id, (prev) => ({ ...prev, people: { ...prev.people, ...people } }));
}

export function prependMyTicket(queryClient: QueryClient, ticket: { id: number; subject: string; status: TicketCore["status"]; category: TicketCore["category"]; order_reference: string | null; updated_at: string }) {
  queryClient.setQueryData<Array<typeof ticket>>(qk.myTickets(), (prev) =>
    prev ? (prev.some((t) => t.id === ticket.id) ? prev : [ticket, ...prev]) : prev,
  );
}

// ---- Mutations ----------------------------------------------------------------

export function useCreateTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTicketInput) => {
      createTicketInputSchema.parse(input);
      return apiFetch("/api/tickets", createTicketResultSchema, { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: (result, input) => {
      prependMyTicket(queryClient, {
        id: result.ticketId,
        subject: input.subject,
        status: "new",
        category: input.category,
        order_reference: input.orderReference ?? null,
        updated_at: new Date().toISOString(),
      });
    },
  });
}

export function usePostMessageMutation(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostMessageInput) => {
      postMessageInputSchema.parse(input);
      return apiFetch(`/api/tickets/${ticketId}/messages`, ticketMessageSchema, { method: "POST", body: JSON.stringify(input) });
    },
    onSuccess: (message, input) => {
      appendTicketMessage(queryClient, ticketId, message);
      if (input.setStatus) {
        patchTicketCore(queryClient, ticketId, { status: input.setStatus });
        patchInboxList(queryClient, (prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: input.setStatus! } : t)));
      }
    },
  });
}

export function useUpdateTicketMutation(ticketId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTicketInput) => {
      updateTicketInputSchema.parse(input);
      return apiFetch(`/api/tickets/${ticketId}`, okSchema, { method: "PATCH", body: JSON.stringify(input) });
    },
    // Optimistic: flip the cache immediately, roll back if the request fails.
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: qk.ticket(ticketId) });
      const previousDetail = queryClient.getQueryData<TicketDetail>(qk.ticket(ticketId));
      const previousInbox = queryClient.getQueryData(qk.inbox());

      const patch: Partial<TicketCore> = {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.assignedAgentId !== undefined && { assigned_agent_id: input.assignedAgentId }),
      };
      patchTicketCore(queryClient, ticketId, patch);
      patchInboxList(queryClient, (prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));

      return { previousDetail, previousInbox };
    },
    onError: (_err, _input, context) => {
      if (context?.previousDetail) queryClient.setQueryData(qk.ticket(ticketId), context.previousDetail);
      if (context?.previousInbox) queryClient.setQueryData(qk.inbox(), context.previousInbox);
    },
  });
}

// Ticket id is a mutate-time argument, not a hook argument: the new-ticket wizard doesn't know
// the id until the create-ticket mutation above has already resolved.
export function useRecordAttachmentMutation() {
  return useMutation({
    mutationFn: ({ ticketId, ...input }: RecordAttachmentInput & { ticketId: number }) => {
      recordAttachmentInputSchema.parse(input);
      return apiFetch(`/api/tickets/${ticketId}/attachments`, okSchema, { method: "POST", body: JSON.stringify(input) });
    },
  });
}

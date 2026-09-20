"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/database.types";
import { appendTicketEvent, appendTicketMessage, mergeTicketPeople, patchTicketCore, useTicketDetailQuery } from "@/lib/queries/tickets";
import { patchInboxList } from "@/lib/queries/inbox";

export type LiveConnection = "connecting" | "live" | "offline";

type TicketRow = Tables<"tickets">;
type MessageRow = Tables<"ticket_messages">;
type EventRow = Tables<"ticket_status_events">;

/**
 * Keeps one ticket's TanStack Query cache entry in sync with the database through Supabase
 * Realtime, instead of holding its own copy of the data in local state. Postgres Changes are
 * filtered by RLS per subscriber, so a customer's socket never receives internal notes.
 */
export function useLiveTicket(ticketId: number) {
  const { data } = useTicketDetailQuery(ticketId);
  const queryClient = useQueryClient();
  const [connection, setConnection] = useState<LiveConnection>("connecting");

  const peopleRef = useRef(data?.people);
  useEffect(() => {
    peopleRef.current = data?.people;
  }, [data?.people]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const ensurePeople = async (ids: Array<string | null | undefined>) => {
      const known = peopleRef.current ?? {};
      const missing = [...new Set(ids.filter((id): id is string => Boolean(id) && !known[id!]))];
      if (missing.length === 0) return;
      const { data: rows } = await supabase.from("profiles").select("id, full_name, role").in("id", missing);
      if (!rows?.length) return;
      mergeTicketPeople(
        queryClient,
        ticketId,
        Object.fromEntries(rows.map((p) => [p.id, { id: p.id, fullName: p.full_name, role: p.role }])),
      );
    };

    (async () => {
      // Make sure the socket carries the signed-in user's JWT so RLS applies to change events.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase
        .channel(`ticket:${ticketId}`)
        .on<MessageRow>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${ticketId}` },
          ({ new: row }) => {
            appendTicketMessage(queryClient, ticketId, {
              id: row.id,
              ticket_id: row.ticket_id,
              author_id: row.author_id,
              body: row.body,
              is_internal_note: row.is_internal_note,
              created_at: row.created_at,
            });
            void ensurePeople([row.author_id]);
          },
        )
        .on<TicketRow>(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` },
          ({ new: row }) => {
            const patch = {
              subject: row.subject,
              category: row.category,
              priority: row.priority,
              status: row.status,
              assigned_agent_id: row.assigned_agent_id,
              first_response_at: row.first_response_at,
              resolved_at: row.resolved_at,
              updated_at: row.updated_at,
            };
            patchTicketCore(queryClient, ticketId, patch);
            patchInboxList(queryClient, (prev) => prev.map((t) => (t.id === ticketId ? { ...t, ...patch } : t)));
            void ensurePeople([row.assigned_agent_id]);
          },
        )
        .on<EventRow>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ticket_status_events", filter: `ticket_id=eq.${ticketId}` },
          ({ new: row }) => {
            appendTicketEvent(queryClient, ticketId, row);
            void ensurePeople([row.changed_by]);
          },
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnection("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("offline");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ticketId, queryClient]);

  return { data, connection };
}

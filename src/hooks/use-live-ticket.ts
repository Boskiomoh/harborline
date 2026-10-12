"use client";

import { useSingleTicket } from "@/hooks/use-app-hooks/use-tickets";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

export type LiveConnection = "connecting" | "live" | "offline";

// Refetches one ticket whenever Supabase Realtime reports a change to it.
// Postgres Changes are filtered by RLS per subscriber, so a customer's socket
// never hears about internal notes, and the refetch goes through the same
// RLS-scoped route handler.
const useLiveTicket = (ticketId: number) => {
  // State
  const [connection, setConnection] = useState<LiveConnection>("connecting");

  // Queries
  const { refetch: ticketRefetch } = useSingleTicket(ticketId);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Make sure the socket carries the signed-in user's JWT so RLS applies to change events.
      await supabase.realtime.setAuth();

      if (cancelled) return;

      channel = supabase
        .channel(`ticket:${ticketId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ticket_messages",
            filter: `ticket_id=eq.${ticketId}`,
          },
          () => ticketRefetch(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tickets",
            filter: `id=eq.${ticketId}`,
          },
          () => ticketRefetch(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ticket_status_events",
            filter: `ticket_id=eq.${ticketId}`,
          },
          () => ticketRefetch(),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnection("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnection("offline");
          }
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [ticketId, ticketRefetch]);

  return connection;
};

export default useLiveTicket;

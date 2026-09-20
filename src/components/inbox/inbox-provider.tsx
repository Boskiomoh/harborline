"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import { useInboxQuery, useSlaPoliciesQuery, useStaffQuery, patchInboxList } from "@/lib/queries/inbox";
import type { InboxTicket } from "@/lib/inbox";
import type { Person, SlaTargets, TicketCore } from "@/lib/tickets";
import type { LiveConnection } from "@/components/tickets/use-live-ticket";

type Status = Enums<"ticket_status">;
type Priority = Enums<"ticket_priority">;

export type InboxFilters = {
  query: string;
  status: "open" | "all" | Status;
  priority: "any" | Priority;
  assignee: "anyone" | "me" | "none" | (string & {});
  sort: "urgency" | "updated" | "oldest";
};

export const DEFAULT_FILTERS: InboxFilters = { query: "", status: "open", priority: "any", assignee: "anyone", sort: "urgency" };

type Unread = Record<number, "reply" | "ticket">;

type InboxValue = {
  tickets: InboxTicket[];
  visible: InboxTicket[];
  filters: InboxFilters;
  setFilters: (patch: Partial<InboxFilters>) => void;
  resetFilters: () => void;
  unread: Unread;
  markRead: (id: number) => void;
  activeId: number | null;
  staff: Person[];
  viewerId: string;
  slaTargets: SlaTargets;
  connection: LiveConnection;
};

const InboxContext = createContext<InboxValue | null>(null);

export function useInbox() {
  const value = useContext(InboxContext);
  if (!value) throw new Error("useInbox must be used inside <InboxProvider>");
  return value;
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

// Stable fallback references while a query hasn't resolved yet, so memoized values below don't
// think "the data changed" on every render just because `data ?? []` made a new empty array.
const EMPTY_TICKETS: InboxTicket[] = [];
const EMPTY_STAFF: Person[] = [];
const EMPTY_SLA_TARGETS = {} as SlaTargets;

function pickCore(row: Tables<"tickets">): TicketCore {
  return {
    id: row.id,
    customer_id: row.customer_id,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assigned_agent_id: row.assigned_agent_id,
    order_reference: row.order_reference,
    first_response_at: row.first_response_at,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Most urgent first: tickets still waiting on a first reply (by SLA due time), then in-progress
 * work (by priority), then tickets waiting on the customer, then resolved.
 */
function urgencyCompare(targets: SlaTargets) {
  const group = (t: InboxTicket) =>
    t.status === "resolved" ? 3 : !t.first_response_at ? 0 : t.status === "waiting_on_customer" ? 2 : 1;
  return (a: InboxTicket, b: InboxTicket) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) {
      const due = (t: InboxTicket) => Date.parse(t.created_at) + targets[t.priority] * 60_000;
      return due(a) - due(b);
    }
    if (ga === 1 && a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  };
}

export function InboxProvider({ viewerId, children }: { viewerId: string; children: React.ReactNode }) {
  // Server-prefetched via HydrationBoundary in inbox/layout.tsx, so these resolve from cache
  // with no client-side request on first render.
  const ticketsQuery = useInboxQuery();
  const staffQuery = useStaffQuery();
  const slaQuery = useSlaPoliciesQuery();
  const tickets = ticketsQuery.data ?? EMPTY_TICKETS;
  const staff = staffQuery.data ?? EMPTY_STAFF;
  const slaTargets = slaQuery.data ?? EMPTY_SLA_TARGETS;

  const queryClient = useQueryClient();
  const [unread, setUnread] = useState<Unread>({});
  const [filters, setFilterState] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [connection, setConnection] = useState<LiveConnection>("connecting");

  const pathname = usePathname();
  const activeId = Number(pathname.match(/^\/inbox\/(\d+)/)?.[1]) || null;

  const activeRef = useRef<number | null>(activeId);
  const staffIdsRef = useRef(new Set(staff.map((s) => s.id)));
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    staffIdsRef.current = new Set(staff.map((s) => s.id));
  }, [staff]);

  const markRead = useCallback((id: number) => {
    setUnread((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const setFilters = useCallback((patch: Partial<InboxFilters>) => setFilterState((prev) => ({ ...prev, ...patch })), []);
  const resetFilters = useCallback(() => setFilterState(DEFAULT_FILTERS), []);

  // One channel keeps the whole list current: new tickets, status/assignment changes, and new replies.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase
        .channel("inbox")
        .on<Tables<"tickets">>("postgres_changes", { event: "INSERT", schema: "public", table: "tickets" }, async ({ new: row }) => {
          const { data: customer } = await supabase.from("profiles").select("full_name").eq("id", row.customer_id).maybeSingle();
          patchInboxList(queryClient, (prev) =>
            prev.some((t) => t.id === row.id) ? prev : [{ ...pickCore(row), customerName: customer?.full_name ?? "", lastMessage: null }, ...prev],
          );
          if (activeRef.current !== row.id) setUnread((prev) => ({ ...prev, [row.id]: "ticket" }));
        })
        .on<Tables<"tickets">>("postgres_changes", { event: "UPDATE", schema: "public", table: "tickets" }, ({ new: row }) => {
          patchInboxList(queryClient, (prev) => prev.map((t) => (t.id === row.id ? { ...t, ...pickCore(row) } : t)));
        })
        .on<Tables<"ticket_messages">>("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, ({ new: row }) => {
          patchInboxList(queryClient, (prev) =>
            prev.map((t) =>
              t.id === row.ticket_id
                ? {
                    ...t,
                    updated_at: row.created_at > t.updated_at ? row.created_at : t.updated_at,
                    lastMessage: { body: row.body, created_at: row.created_at, is_internal_note: row.is_internal_note, author_id: row.author_id },
                  }
                : t,
            ),
          );
          const fromCustomer = !row.is_internal_note && row.author_id && !staffIdsRef.current.has(row.author_id);
          if (fromCustomer && activeRef.current !== row.ticket_id) {
            setUnread((prev) => (prev[row.ticket_id] ? prev : { ...prev, [row.ticket_id]: "reply" }));
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") setConnection("live");
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("offline");
        });
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const visible = useMemo(() => {
    const query = filters.query.trim().toLowerCase().replace(/^#/, "");
    const filtered = tickets.filter((t) => {
      if (filters.status === "open" ? t.status === "resolved" : filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.priority !== "any" && t.priority !== filters.priority) return false;
      if (filters.assignee === "me" && t.assigned_agent_id !== viewerId) return false;
      if (filters.assignee === "none" && t.assigned_agent_id !== null) return false;
      if (!["anyone", "me", "none"].includes(filters.assignee) && t.assigned_agent_id !== filters.assignee) return false;
      if (!query) return true;
      return [t.subject, t.customerName, String(t.id), t.order_reference ?? ""].some((field) => field.toLowerCase().includes(query));
    });

    const sorted = [...filtered];
    if (filters.sort === "urgency") sorted.sort(urgencyCompare(slaTargets));
    else if (filters.sort === "updated") sorted.sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    else sorted.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    return sorted;
  }, [tickets, filters, viewerId, slaTargets]);

  const value = useMemo<InboxValue>(
    () => ({ tickets, visible, filters, setFilters, resetFilters, unread, markRead, activeId, staff, viewerId, slaTargets, connection }),
    [tickets, visible, filters, setFilters, resetFilters, unread, markRead, activeId, staff, viewerId, slaTargets, connection],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

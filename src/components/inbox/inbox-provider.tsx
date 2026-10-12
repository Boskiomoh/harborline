"use client";

import {
  useInboxTickets,
  useSlaPolicies,
  useStaff,
} from "@/hooks/use-app-hooks/use-inbox";
import type { LiveConnection } from "@/hooks/use-live-ticket";
import type { InboxTicket } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import type { Person, SlaTargets } from "@/lib/tickets";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";

type Status = Enums<"ticket_status">;
type Priority = Enums<"ticket_priority">;

export interface InboxFilters {
  query: string;
  status: "open" | "all" | Status;
  priority: "any" | Priority;
  assignee: "anyone" | "me" | "none" | (string & {});
  sort: "urgency" | "updated" | "oldest";
}

export const DEFAULT_FILTERS: InboxFilters = {
  query: "",
  status: "open",
  priority: "any",
  assignee: "anyone",
  sort: "urgency",
};

type Unread = Record<number, "reply" | "ticket">;

interface InboxValue {
  tickets: InboxTicket[];
  visible: InboxTicket[];
  filters: InboxFilters;
  setFilters: (patch: Partial<InboxFilters>) => void;
  resetFilters: () => void;
  unread: Unread;
  markRead: (id: number) => void;
  dismissedTriage: number[];
  dismissTriage: (id: number) => void;
  activeId: number | null;
  staff: Person[];
  viewerId: string;
  slaTargets: SlaTargets;
  connection: LiveConnection;
  inboxTicketsRefetch: () => void;
}

const InboxContext = createContext<InboxValue | null>(null);

export const useInbox = () => {
  const value = useContext(InboxContext);

  if (!value) throw new Error("useInbox must be used inside <InboxProvider>");

  return value;
};

const priorityRank: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

// Most urgent first: tickets still waiting on a first reply (by SLA due time),
// then in-progress work (by priority), then tickets waiting on the customer,
// then resolved.
const urgencyCompare = (targets: SlaTargets) => {
  const group = (t: InboxTicket) =>
    t.status === "resolved"
      ? 3
      : !t.first_response_at
        ? 0
        : t.status === "waiting_on_customer"
          ? 2
          : 1;

  return (a: InboxTicket, b: InboxTicket) => {
    const ga = group(a);
    const gb = group(b);

    if (ga !== gb) return ga - gb;

    if (ga === 0) {
      const due = (t: InboxTicket) =>
        Date.parse(t.created_at) + targets[t.priority] * 60_000;

      return due(a) - due(b);
    }

    if (ga === 1 && a.priority !== b.priority) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }

    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  };
};

interface InboxProviderProps {
  viewerId: string;
  children: ReactNode;
}

export const InboxProvider = ({ viewerId, children }: InboxProviderProps) => {
  // Router
  const pathname = usePathname();
  const activeId = Number(pathname.match(/^\/inbox\/(\d+)/)?.[1]) || null;

  // State
  const [unread, setUnread] = useState<Unread>({});
  const [filters, setFilterState] = useState<InboxFilters>(DEFAULT_FILTERS);
  const [connection, setConnection] = useState<LiveConnection>("connecting");
  const [dismissedTriage, setDismissedTriage] = useState<number[]>([]);

  // Queries
  const { data: inboxTicketsData, refetch: inboxTicketsRefetch } =
    useInboxTickets();
  const { data: staffData } = useStaff();
  const { data: slaPoliciesData } = useSlaPolicies();

  // Derived
  const tickets: InboxTicket[] = inboxTicketsData ?? [];
  const staff: Person[] = staffData ?? [];
  const slaTargets: SlaTargets = slaPoliciesData ?? {};

  // The ticket on screen is read: clear its badge during render instead of in
  // an effect, however the agent got to it.
  if (activeId !== null && activeId in unread) {
    const next = { ...unread };
    delete next[activeId];
    setUnread(next);
  }

  // Handlers
  const markRead = (id: number) => {
    setUnread((prev) => {
      if (!(id in prev)) return prev;

      const next = { ...prev };
      delete next[id];

      return next;
    });
  };

  const setFilters = (patch: Partial<InboxFilters>) =>
    setFilterState((prev) => ({ ...prev, ...patch }));

  const resetFilters = () => setFilterState(DEFAULT_FILTERS);

  const dismissTriage = (id: number) =>
    setDismissedTriage((prev) => [...prev, id]);

  const handleTicketInserted = useEffectEvent((row: Tables<"tickets">) => {
    inboxTicketsRefetch();

    if (activeId !== row.id) {
      setUnread((prev) => ({ ...prev, [row.id]: "ticket" }));
    }
  });

  const handleMessageInserted = useEffectEvent(
    (row: Tables<"ticket_messages">) => {
      inboxTicketsRefetch();

      const fromCustomer =
        !row.is_internal_note &&
        row.author_id &&
        !staff.some((s) => s.id === row.author_id);

      if (fromCustomer && activeId !== row.ticket_id) {
        setUnread((prev) =>
          prev[row.ticket_id] ? prev : { ...prev, [row.ticket_id]: "reply" },
        );
      }
    },
  );

  const handleTicketUpdated = useEffectEvent(() => inboxTicketsRefetch());

  // One channel keeps the whole list current: new tickets, status/assignment
  // changes, and new replies.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      await supabase.realtime.setAuth();

      if (cancelled) return;

      channel = supabase
        .channel("inbox")
        .on<Tables<"tickets">>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "tickets" },
          ({ new: row }) => handleTicketInserted(row),
        )
        .on<Tables<"tickets">>(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "tickets" },
          () => handleTicketUpdated(),
        )
        .on<Tables<"ticket_messages">>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "ticket_messages" },
          ({ new: row }) => handleMessageInserted(row),
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
  }, []);

  const query = filters.query.trim().toLowerCase().replace(/^#/, "");
  const visible = tickets
    .filter((t) => {
      if (
        filters.status === "open"
          ? t.status === "resolved"
          : filters.status !== "all" && t.status !== filters.status
      ) {
        return false;
      }
      if (filters.priority !== "any" && t.priority !== filters.priority) {
        return false;
      }
      if (filters.assignee === "me" && t.assigned_agent_id !== viewerId) {
        return false;
      }
      if (filters.assignee === "none" && t.assigned_agent_id !== null) {
        return false;
      }
      if (
        !["anyone", "me", "none"].includes(filters.assignee) &&
        t.assigned_agent_id !== filters.assignee
      ) {
        return false;
      }
      if (!query) return true;

      return [
        t.subject,
        t.customerName,
        String(t.id),
        t.order_reference ?? "",
      ].some((field) => field.toLowerCase().includes(query));
    })
    .sort(
      filters.sort === "urgency"
        ? urgencyCompare(slaTargets)
        : filters.sort === "updated"
          ? (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
          : (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );

  return (
    <InboxContext.Provider
      value={{
        tickets,
        visible,
        filters,
        setFilters,
        resetFilters,
        unread,
        markRead,
        dismissedTriage,
        dismissTriage,
        activeId,
        staff,
        viewerId,
        slaTargets,
        connection,
        inboxTicketsRefetch,
      }}
    >
      {children}
    </InboxContext.Provider>
  );
};

import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/lib/supabase/database.types";
import { isStaff, type Role } from "@/lib/roles";
import type { Viewer } from "@/lib/auth";

export type Person = { id: string; fullName: string; role: Role };
export type People = Record<string, Person>;

export type TicketMessage = Pick<Tables<"ticket_messages">, "id" | "ticket_id" | "author_id" | "body" | "is_internal_note" | "created_at">;
export type TicketEvent = Pick<Tables<"ticket_status_events">, "id" | "ticket_id" | "from_status" | "to_status" | "changed_by" | "created_at">;
export type TicketAttachment = {
  id: number;
  messageId: number | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  url: string | null;
};

export type TicketCore = Pick<
  Tables<"tickets">,
  | "id"
  | "customer_id"
  | "subject"
  | "category"
  | "priority"
  | "status"
  | "assigned_agent_id"
  | "order_reference"
  | "first_response_at"
  | "resolved_at"
  | "created_at"
  | "updated_at"
>;

export type SlaTargets = Record<Enums<"ticket_priority">, number>;

export type TicketDetail = {
  ticket: TicketCore;
  messages: TicketMessage[];
  events: TicketEvent[];
  attachments: TicketAttachment[];
  people: People;
  slaTargets: SlaTargets;
};

export type MyTicketRow = Pick<Tables<"tickets">, "id" | "subject" | "status" | "category" | "order_reference" | "updated_at">;

export const TICKET_CORE_COLUMNS =
  "id, customer_id, subject, category, priority, status, assigned_agent_id, order_reference, first_response_at, resolved_at, created_at, updated_at";

/** "My tickets" list (customer portal). RLS already scopes this to the signed-in customer. */
export async function getMyTicketsList(): Promise<MyTicketRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, subject, status, category, order_reference, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getSlaTargets(): Promise<SlaTargets> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sla_policies").select("priority, first_response_minutes");
  if (error) throw error;
  return Object.fromEntries(data.map((row) => [row.priority, row.first_response_minutes])) as SlaTargets;
}

export async function getPeople(ids: Array<string | null | undefined>): Promise<People> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, role").in("id", unique);
  if (error) throw error;
  return Object.fromEntries(data.map((p) => [p.id, { id: p.id, fullName: p.full_name, role: p.role }]));
}

/** Everything a ticket page needs. RLS decides what comes back: customers never receive internal notes. */
export async function getTicketDetail(id: number): Promise<TicketDetail | null> {
  const supabase = await createClient();

  const [ticketRes, messagesRes, eventsRes, attachmentsRes, slaTargets] = await Promise.all([
    supabase.from("tickets").select(TICKET_CORE_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("ticket_messages").select("id, ticket_id, author_id, body, is_internal_note, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_status_events").select("id, ticket_id, from_status, to_status, changed_by, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("ticket_attachments").select("id, message_id, storage_path, file_name, mime_type, size_bytes").eq("ticket_id", id).order("created_at"),
    getSlaTargets(),
  ]);

  if (ticketRes.error) throw ticketRes.error;
  if (!ticketRes.data) return null;
  if (messagesRes.error) throw messagesRes.error;
  if (eventsRes.error) throw eventsRes.error;
  if (attachmentsRes.error) throw attachmentsRes.error;

  const ticket = ticketRes.data;
  const [people, signed] = await Promise.all([
    getPeople([
      ticket.customer_id,
      ticket.assigned_agent_id,
      ...messagesRes.data.map((m) => m.author_id),
      ...eventsRes.data.map((e) => e.changed_by),
    ]),
    attachmentsRes.data.length > 0
      ? supabase.storage.from("ticket-attachments").createSignedUrls(attachmentsRes.data.map((a) => a.storage_path), 60 * 60)
      : Promise.resolve({ data: [] as Array<{ path: string | null; signedUrl: string }> }),
  ]);

  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  const attachments: TicketAttachment[] = attachmentsRes.data.map((a) => ({
    id: a.id,
    messageId: a.message_id,
    fileName: a.file_name,
    mimeType: a.mime_type,
    sizeBytes: a.size_bytes,
    url: urlByPath.get(a.storage_path) ?? null,
  }));

  return { ticket, messages: messagesRes.data, events: eventsRes.data, attachments, people, slaTargets };
}

/**
 * Ticket detail as a given viewer sees it: for staff, every staff member is folded into `people`
 * (regardless of whether they've posted yet) so the thread and assignment UI can always resolve a
 * name. The route handler and the server-side page prefetch both call this, so a client fetch to
 * `/api/tickets/[id]` always matches what the page hydrated with.
 */
export async function getTicketDetailForViewer(id: number, viewer: Viewer): Promise<TicketDetail | null> {
  const detail = await getTicketDetail(id);
  if (!detail) return null;
  if (!isStaff(viewer.role)) return detail;

  const supabase = await createClient();
  const { data: staff, error } = await supabase.from("profiles").select("id, full_name, role").in("role", ["agent", "admin"]);
  if (error) throw error;

  return {
    ...detail,
    people: {
      ...detail.people,
      ...Object.fromEntries(staff.map((p) => [p.id, { id: p.id, fullName: p.full_name, role: p.role }])),
    },
  };
}

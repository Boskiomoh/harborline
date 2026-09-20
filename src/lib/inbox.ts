import { createClient } from "@/lib/supabase/server";
import type { Person, TicketCore } from "@/lib/tickets";

export type InboxLastMessage = { body: string; created_at: string; is_internal_note: boolean; author_id: string | null };
export type InboxTicket = TicketCore & { customerName: string; lastMessage: InboxLastMessage | null };
export type CannedResponse = { id: number; title: string; body: string; agent_id: string };

export async function getInboxTickets(): Promise<InboxTicket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select(
      "id, customer_id, subject, category, priority, status, assigned_agent_id, order_reference, first_response_at, resolved_at, created_at, updated_at, customer:profiles!tickets_customer_id_fkey(full_name), ticket_messages(body, created_at, is_internal_note, author_id)",
    )
    .order("updated_at", { ascending: false })
    .order("created_at", { referencedTable: "ticket_messages", ascending: false })
    .limit(1, { referencedTable: "ticket_messages" });

  if (error) throw error;

  return data.map(({ customer, ticket_messages, ...ticket }) => ({
    ...ticket,
    customerName: customer?.full_name ?? "",
    lastMessage: ticket_messages[0] ?? null,
  }));
}

export async function getStaff(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, role").in("role", ["agent", "admin"]).order("full_name");
  if (error) throw error;
  return data.map((p) => ({ id: p.id, fullName: p.full_name, role: p.role }));
}

export async function getCannedResponses(): Promise<CannedResponse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("canned_responses").select("id, title, body, agent_id").order("title");
  if (error) throw error;
  return data;
}

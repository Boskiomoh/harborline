import { NextResponse } from "next/server";
import { createTicketInputSchema, createTicketResultSchema, myTicketsSchema } from "@/lib/api/schemas";
import { apiError, parseBody, requireApiRole } from "@/lib/api/guard";
import { getMyTicketsList } from "@/lib/tickets";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const auth = await requireApiRole(["customer"]);
  if ("response" in auth) return auth.response;

  const tickets = await getMyTicketsList();
  return NextResponse.json(myTicketsSchema.parse(tickets));
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["customer"]);
  if ("response" in auth) return auth.response;

  const body = await parseBody(request, createTicketInputSchema);
  if ("response" in body) return body.response;
  const { category, subject, description, orderReference } = body.data;

  const supabase = await createClient();
  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({ customer_id: auth.viewer.id, category, subject, order_reference: orderReference || null })
    .select("id")
    .single();
  if (ticketError || !ticket) return apiError(500, { error: "generic" });

  const { data: message, error: messageError } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: ticket.id, author_id: auth.viewer.id, body: description })
    .select("id")
    .single();
  if (messageError || !message) return apiError(500, { error: "generic" });

  return NextResponse.json(createTicketResultSchema.parse({ ticketId: ticket.id, messageId: message.id }), { status: 201 });
}

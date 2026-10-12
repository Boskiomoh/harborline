import { apiError, parseBody, requireApiRole } from "@/lib/api/guard";
import { createTicketInputSchema } from "@/lib/api/schemas";
import { createClient } from "@/lib/supabase/server";
import { getMyTicketsList } from "@/lib/tickets";
import { NextRequest, NextResponse } from "next/server";

// Get the signed-in customer's tickets
export async function GET() {
  const auth = await requireApiRole(["customer"]);
  if ("response" in auth) return auth.response;

  try {
    const data = await getMyTicketsList();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[tickets] list:", error);
    return apiError(500, { error: "generic" });
  }
}

// Create a ticket and its opening message
export async function POST(req: NextRequest) {
  const auth = await requireApiRole(["customer"]);
  if ("response" in auth) return auth.response;

  const body = await parseBody(req, createTicketInputSchema);
  if ("response" in body) return body.response;

  const { category, subject, description, orderReference } = body.data;
  const supabase = await createClient();

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      customer_id: auth.viewer.id,
      category,
      subject,
      order_reference: orderReference || null,
    })
    .select("id")
    .single();

  if (ticketError || !ticket) return apiError(500, { error: "generic" });

  const { data: message, error: messageError } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: ticket.id,
      author_id: auth.viewer.id,
      body: description,
    })
    .select("id")
    .single();

  if (messageError || !message) return apiError(500, { error: "generic" });

  return NextResponse.json(
    { ticketId: ticket.id, messageId: message.id },
    { status: 201 },
  );
}

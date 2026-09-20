import { NextResponse } from "next/server";
import { inboxTicketsSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/api/guard";
import { getInboxTickets } from "@/lib/inbox";

export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  const tickets = await getInboxTickets();
  return NextResponse.json(inboxTicketsSchema.parse(tickets));
}

import { NextResponse } from "next/server";
import { ticketDetailSchema, updateTicketInputSchema } from "@/lib/api/schemas";
import { apiError, parseBody, parseIdParam, requireApiViewer, requireApiRole } from "@/lib/api/guard";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  // RLS decides what comes back: a customer requesting another customer's ticket gets null here,
  // same as a missing id, so this never leaks whether the id belongs to someone else.
  const detail = await getTicketDetailForViewer(parsedId.id, auth.viewer);
  if (!detail) return apiError(404, { error: "not_found" });

  return NextResponse.json(ticketDetailSchema.parse(detail));
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/tickets/[id]">) {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  const body = await parseBody(request, updateTicketInputSchema);
  if ("response" in body) return body.response;
  const { status, priority, assignedAgentId } = body.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update({
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(assignedAgentId !== undefined && { assigned_agent_id: assignedAgentId }),
    })
    .eq("id", parsedId.id)
    .select("id");

  if (error) return apiError(500, { error: "generic" });
  if (!data.length) return apiError(404, { error: "not_found" });

  return NextResponse.json({ ok: true });
}

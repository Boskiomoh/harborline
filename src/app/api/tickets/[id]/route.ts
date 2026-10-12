import {
  apiError,
  parseBody,
  parseIdParam,
  requireApiRole,
  requireApiViewer,
} from "@/lib/api/guard";
import { updateTicketInputSchema } from "@/lib/api/schemas";
import { createClient } from "@/lib/supabase/server";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { NextRequest, NextResponse } from "next/server";

// Get one ticket with its thread, as the signed-in viewer is allowed to see it
export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]">,
) {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  try {
    // RLS decides what comes back: a customer requesting another customer's ticket gets null here,
    // same as a missing id, so this never leaks whether the id belongs to someone else.
    const detail = await getTicketDetailForViewer(parsedId.id, auth.viewer);

    if (!detail) return apiError(404, { error: "not_found" });

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[tickets] get:", error);
    return apiError(500, { error: "generic" });
  }
}

// Update a ticket's status, priority, category or assignee
export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]">,
) {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  const body = await parseBody(req, updateTicketInputSchema);
  if ("response" in body) return body.response;

  const { status, priority, category, assignedAgentId } = body.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tickets")
    .update({
      ...(status !== undefined && { status }),
      ...(priority !== undefined && { priority }),
      ...(category !== undefined && { category }),
      ...(assignedAgentId !== undefined && {
        assigned_agent_id: assignedAgentId,
      }),
    })
    .eq("id", parsedId.id)
    .select("id");

  if (error) return apiError(500, { error: "generic" });
  if (!data.length) return apiError(404, { error: "not_found" });

  return NextResponse.json({ ok: true });
}

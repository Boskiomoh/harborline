import {
  apiError,
  parseBody,
  parseIdParam,
  requireApiViewer,
} from "@/lib/api/guard";
import { postMessageInputSchema } from "@/lib/api/schemas";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Post a reply or internal note, optionally changing the ticket's status
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]/messages">,
) {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  const body = await parseBody(req, postMessageInputSchema);
  if ("response" in body) return body.response;

  const { body: text, internal, setStatus } = body.data;

  // RLS rejects these too; checking here turns it into a clean 403 instead of a database error.
  if ((internal || setStatus) && !isStaff(auth.viewer.role)) {
    return apiError(403, { error: "forbidden" });
  }

  const supabase = await createClient();
  const { data: message, error } = await supabase
    .from("ticket_messages")
    .insert({
      ticket_id: parsedId.id,
      author_id: auth.viewer.id,
      body: text,
      is_internal_note: internal,
    })
    .select("id, ticket_id, author_id, body, is_internal_note, created_at")
    .single();

  if (error || !message) {
    const forbidden = error?.code === "42501";

    return apiError(forbidden ? 403 : 500, {
      error: forbidden ? "forbidden" : "generic",
    });
  }

  if (setStatus) {
    const { error: statusError } = await supabase
      .from("tickets")
      .update({ status: setStatus })
      .eq("id", parsedId.id);

    if (statusError) return apiError(500, { error: "generic" });
  }

  return NextResponse.json(message, { status: 201 });
}

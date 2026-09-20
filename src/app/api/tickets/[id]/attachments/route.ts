import { NextResponse } from "next/server";
import { recordAttachmentInputSchema } from "@/lib/api/schemas";
import { apiError, parseBody, parseIdParam, requireApiViewer } from "@/lib/api/guard";
import { createClient } from "@/lib/supabase/server";

/**
 * Records the metadata row for a file the browser already uploaded straight to Supabase Storage
 * (see new-ticket-wizard.tsx) — Storage's own RLS policies already confined that upload to the
 * caller's own ticket folder, this just makes the row (and therefore the file) show up in the
 * thread. Rejected the same way by RLS if `ticket_id`'s folder doesn't belong to the caller.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/tickets/[id]/attachments">) {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  const body = await parseBody(request, recordAttachmentInputSchema);
  if ("response" in body) return body.response;
  const { messageId, storagePath, fileName, mimeType, sizeBytes } = body.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ticket_attachments").insert({
    ticket_id: parsedId.id,
    message_id: messageId,
    storage_path: storagePath,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    uploaded_by: auth.viewer.id,
  });
  if (error) return apiError(error.code === "42501" ? 403 : 500, { error: error.code === "42501" ? "forbidden" : "generic" });

  return NextResponse.json({ ok: true }, { status: 201 });
}

import {
  apiError,
  parseBody,
  parseIdParam,
  requireApiViewer,
} from "@/lib/api/guard";
import { recordAttachmentInputSchema } from "@/lib/api/schemas";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Record the metadata row for a file the browser already uploaded straight to
// Supabase Storage, so it shows in the thread. Storage's own RLS already
// confined the upload to the caller's ticket folder.
export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]/attachments">,
) {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const { id: rawId } = await ctx.params;
  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId.response;

  const body = await parseBody(req, recordAttachmentInputSchema);
  if ("response" in body) return body.response;

  const { messageId, storagePath, fileName, mimeType, sizeBytes } = body.data;

  // A row may only claim a file inside its own ticket's folder: the storage select policy lets
  // anyone who can see the row read the file, so a foreign path would unlock someone else's
  // upload. The database enforces the same rule (ticket_attachments_path_in_ticket).
  if (!storagePath.startsWith(`${parsedId.id}/`)) {
    return apiError(403, { error: "forbidden" });
  }

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

  if (error) {
    // 42501 RLS, 23514 path check, 23505 path already claimed: all "not yours to attach".
    const forbidden = ["42501", "23514", "23505"].includes(error.code);

    return apiError(forbidden ? 403 : 500, {
      error: forbidden ? "forbidden" : "generic",
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

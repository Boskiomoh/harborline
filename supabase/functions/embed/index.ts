// Harborline AI Assist — embedding Edge Function (docs/AI-ASSIST.md step D).
//
// Two modes, one model (gte-small, 384 dims, runs inside the Edge runtime — no external key):
//
//   { text }                 -> { embedding: number[] }
//     Query-time embedding for retrieval. Requires a signed-in staff user's JWT.
//
//   { index: { source_type: "canned_response" | "resolved_ticket", source_id } }
//   { index: { ticket_id } } -> { indexed: number, removed: number }
//     Embeds a source row into knowledge_chunks. Called by the database triggers (pg_net), which
//     send the Vault secret in `x-embed-secret`, and by the backfill script, which sends a staff
//     JWT. The function reads the content itself with the service role and only indexes what the
//     eligibility rules allow (any canned response; a staff-authored, non-internal message on a
//     resolved ticket), so even a valid caller can never inject content or index an internal note.
//     The secret stops strangers from spending the project's function invocations on re-indexing.
//
// Deployed with verify_jwt = false because the database triggers call it without a user JWT;
// both modes do their own caller check below.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_CONTENT = 4000;
const MAX_QUERY = 8000;

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// @ts-ignore Supabase.ai is a global provided by the Edge runtime.
const session = new Supabase.ai.Session("gte-small");

async function embed(text: string): Promise<number[]> {
  const output = await session.run(text, { mean_pool: true, normalize: true });
  return Array.from(output as ArrayLike<number>);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function clip(text: string) {
  return text.length > MAX_CONTENT ? text.slice(0, MAX_CONTENT) : text;
}

async function isStaffToken(authorization: string | null): Promise<boolean> {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return false;
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return profile?.role === "agent" || profile?.role === "admin";
}

/** The database triggers' shared secret, checked against Vault (it never leaves the database). */
async function isTriggerSecret(candidate: string | null): Promise<boolean> {
  if (!candidate || candidate.length !== 64) return false;
  const { data, error } = await admin.rpc("embed_secret_matches", { candidate });
  if (error) {
    console.error("embed secret check failed", error.message);
    return false;
  }
  return data === true;
}

async function upsertChunk(sourceType: "canned_response" | "resolved_ticket", sourceId: number, category: string | null, content: string) {
  const text = clip(content.trim());
  if (!text) return 0;
  const embedding = await embed(text);
  const { error } = await admin
    .from("knowledge_chunks")
    .upsert(
      { source_type: sourceType, source_id: sourceId, category, content: text, embedding: JSON.stringify(embedding) },
      { onConflict: "source_type,source_id" },
    );
  if (error) throw error;
  return 1;
}

async function removeChunk(sourceType: string, sourceId: number) {
  const { count, error } = await admin
    .from("knowledge_chunks")
    .delete({ count: "exact" })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);
  if (error) throw error;
  return count ?? 0;
}

async function indexCannedResponse(id: number) {
  const { data, error } = await admin.from("canned_responses").select("id, title, body").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return { indexed: 0, removed: await removeChunk("canned_response", id) };
  return { indexed: await upsertChunk("canned_response", data.id, null, `${data.title}\n\n${data.body}`), removed: 0 };
}

type EligibleMessage = { id: number; body: string; subject: string; category: string };

/** Staff-authored, non-internal messages on resolved tickets. The only ticket content that may become a chunk. */
async function eligibleMessages(filter: { messageId?: number; ticketId?: number }): Promise<EligibleMessage[]> {
  let query = admin
    .from("ticket_messages")
    .select("id, body, is_internal_note, author:profiles!ticket_messages_author_id_fkey(role), ticket:tickets!inner(subject, category, status)")
    .eq("is_internal_note", false)
    .eq("ticket.status", "resolved");
  if (filter.messageId !== undefined) query = query.eq("id", filter.messageId);
  if (filter.ticketId !== undefined) query = query.eq("ticket_id", filter.ticketId);

  const { data, error } = await query;
  if (error) throw error;

  // deno-lint-ignore no-explicit-any
  return (data as any[])
    .filter((m) => m.author?.role === "agent" || m.author?.role === "admin")
    .map((m) => ({ id: m.id, body: m.body, subject: m.ticket.subject, category: m.ticket.category }));
}

async function indexMessages(filter: { messageId?: number; ticketId?: number }) {
  const messages = await eligibleMessages(filter);
  let indexed = 0;
  for (const m of messages) {
    indexed += await upsertChunk("resolved_ticket", m.id, m.category, `Ticket: ${m.subject}\n\n${m.body}`);
  }
  // A single message that no longer qualifies (deleted, or its ticket isn't resolved) shouldn't
  // leave a stale chunk behind.
  const removed = filter.messageId !== undefined && messages.length === 0 ? await removeChunk("resolved_ticket", filter.messageId) : 0;
  return { indexed, removed };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  try {
    if (typeof body.text === "string") {
      if (!(await isStaffToken(req.headers.get("Authorization")))) return json({ error: "forbidden" }, 403);
      const text = body.text.trim().slice(0, MAX_QUERY);
      if (!text) return json({ error: "empty_text" }, 400);
      return json({ embedding: await embed(text) });
    }

    const index = body.index as Record<string, unknown> | undefined;
    if (index && typeof index === "object") {
      const allowed =
        (await isTriggerSecret(req.headers.get("x-embed-secret"))) || (await isStaffToken(req.headers.get("Authorization")));
      if (!allowed) return json({ error: "forbidden" }, 403);

      const sourceId = Number(index.source_id);
      const ticketId = Number(index.ticket_id);
      if (index.source_type === "canned_response" && Number.isInteger(sourceId)) return json(await indexCannedResponse(sourceId));
      if (index.source_type === "resolved_ticket" && Number.isInteger(sourceId)) return json(await indexMessages({ messageId: sourceId }));
      if (index.ticket_id !== undefined && Number.isInteger(ticketId)) return json(await indexMessages({ ticketId }));
    }

    return json({ error: "invalid_request" }, 400);
  } catch (error) {
    console.error("embed failed", error);
    return json({ error: "embed_failed" }, 500);
  }
});

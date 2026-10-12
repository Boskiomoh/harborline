/**
 * Retrieval for AI Assist — the "R" in RAG (docs/AI-ASSIST.md §2). Nothing here trains anything:
 * the ticket's text is turned into a vector by the `embed` Edge Function (gte-small, 384 dims),
 * then Postgres finds the nearest stored canned responses and resolved-ticket replies.
 *
 * Takes the Supabase client as an argument rather than creating one, so it runs the same from a
 * route handler (cookie-bound server client) and from a plain Node script. Either way the query
 * runs as the signed-in user, so the knowledge_chunks RLS policy (staff only) still applies.
 */
import type { Database, Enums } from "@/lib/supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type KnowledgeSource = {
  id: number;
  kind: "canned_response" | "resolved_ticket";
  sourceId: number;
  /** For resolved-ticket chunks: the ticket the reply came from. */
  ticketId: number | null;
  /** For canned-response chunks: the response's title. */
  title: string | null;
  content: string;
  similarity: number;
};

/**
 * gte-small puts almost any two English support messages at ~0.70–0.72 cosine similarity, so the
 * floor sits above that. Calibrated on the seed data (subject + latest customer messages as the
 * query): genuinely related sources land at ~0.79–0.85, unrelated ones at ~0.70–0.72. Below the
 * floor a "source" is noise the model would be told to lean on, so returning none is better.
 */
const MIN_SIMILARITY = 0.78;

/** Text -> 384-dim vector, via the Edge Function. Authenticated as the calling user (staff only). */
export async function embed(
  supabase: SupabaseClient<Database>,
  text: string,
): Promise<number[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("embed: no session");

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`embed: ${response.status}`);
  const body = (await response.json()) as { embedding?: number[] };
  if (!Array.isArray(body.embedding) || body.embedding.length !== 384)
    throw new Error("embed: bad response");
  return body.embedding;
}

async function match(
  supabase: SupabaseClient<Database>,
  embedding: number[],
  category: Enums<"ticket_category"> | null,
  count: number,
): Promise<KnowledgeSource[]> {
  const { data, error } = await supabase.rpc("match_knowledge_chunks", {
    query_embedding: JSON.stringify(embedding),
    ...(category && { match_category: category }),
    match_count: count,
    min_similarity: MIN_SIMILARITY,
  });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    kind:
      row.source_type === "canned_response"
        ? "canned_response"
        : "resolved_ticket",
    sourceId: row.source_id,
    ticketId: row.ticket_id ?? null,
    title: row.canned_title ?? null,
    content: row.content,
    similarity: row.similarity,
  }));
}

/**
 * The `k` stored chunks closest in meaning to `text`, best first. Scoped to `category` (plus the
 * uncategorised canned responses) first; if that turns up fewer than `k`, widened to every
 * category. `excludeTicketId` keeps a resolved ticket from citing its own replies back at itself.
 */
export async function retrieveContext(
  supabase: SupabaseClient<Database>,
  text: string,
  category: Enums<"ticket_category"> | null,
  k = 4,
  options: { excludeTicketId?: number } = {},
): Promise<KnowledgeSource[]> {
  const embedding = await embed(supabase, text);
  const keep = (s: KnowledgeSource) =>
    options.excludeTicketId === undefined ||
    s.ticketId !== options.excludeTicketId;
  const headroom = k + 4;

  const scoped = (await match(supabase, embedding, category, headroom)).filter(
    keep,
  );
  if (scoped.length >= k || !category) return scoped.slice(0, k);

  const seen = new Set(scoped.map((s) => s.id));
  const wider = (await match(supabase, embedding, null, headroom)).filter(
    (s) => keep(s) && !seen.has(s.id),
  );
  return [...scoped, ...wider]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

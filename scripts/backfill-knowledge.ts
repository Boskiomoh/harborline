/**
 * One-off backfill for AI Assist (docs/AI-ASSIST.md step E).
 *
 * Embeds every existing canned response and every staff-authored, non-internal message on an
 * already-resolved ticket into `knowledge_chunks`, skipping any (source_type, source_id) that's
 * already there — so a second run inserts nothing.
 *
 *   node scripts/backfill-knowledge.ts
 *
 * No service-role key needed: the script signs in as the agent demo account (staff can read the
 * sources and existing chunks through RLS) and asks the `embed` Edge Function to index each
 * missing source. The function reads the content itself with the service role and re-checks
 * eligibility, so this script can't write anything the triggers wouldn't.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const email = process.env.BACKFILL_EMAIL ?? "agent@harborline.app";
const password = process.env.BACKFILL_PASSWORD ?? "harborline-demo-2026";

const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  // The embed function's index mode needs a caller check: the database triggers send a Vault
  // secret, this script sends the staff session.
  const authorization = `Bearer ${auth.session.access_token}`;

  const [canned, messages, chunks] = await Promise.all([
    supabase.from("canned_responses").select("id"),
    supabase
      .from("ticket_messages")
      .select("id, author:profiles!ticket_messages_author_id_fkey(role), ticket:tickets!inner(status)")
      .eq("is_internal_note", false)
      .eq("ticket.status", "resolved"),
    supabase.from("knowledge_chunks").select("source_type, source_id"),
  ]);
  if (canned.error) throw canned.error;
  if (messages.error) throw messages.error;
  if (chunks.error) throw chunks.error;

  const existing = new Set(chunks.data.map((c) => `${c.source_type}:${c.source_id}`));
  const sources = [
    ...canned.data.map((c) => ({ source_type: "canned_response" as const, source_id: c.id })),
    ...messages.data
      .filter((m) => m.author?.role === "agent" || m.author?.role === "admin")
      .map((m) => ({ source_type: "resolved_ticket" as const, source_id: m.id })),
  ];
  const missing = sources.filter((s) => !existing.has(`${s.source_type}:${s.source_id}`));

  console.log(`${sources.length} eligible sources, ${sources.length - missing.length} already embedded, ${missing.length} to embed.`);

  let inserted = 0;
  let failed = 0;
  for (const source of missing) {
    const response = await fetch(`${url}/functions/v1/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authorization },
      body: JSON.stringify({ index: source }),
    });
    const result = (await response.json().catch(() => null)) as { indexed?: number } | null;
    if (response.ok && result?.indexed) {
      inserted += result.indexed;
      process.stdout.write(".");
    } else {
      failed += 1;
      console.error(`\n  failed ${source.source_type}:${source.source_id} (${response.status})`, result);
    }
  }

  console.log(`\nInserted ${inserted} chunk(s)${failed ? `, ${failed} failed` : ""}.`);
  // Local only: the default global sign-out would end every visitor's session on the shared demo account.
  await supabase.auth.signOut({ scope: "local" });
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

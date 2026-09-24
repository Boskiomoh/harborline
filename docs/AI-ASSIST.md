# Harborline — AI Assist

An AI layer added to the existing agent inbox: drafts a reply from your own canned responses
and past resolved tickets, suggests a category/priority for new tickets, and summarizes long
threads. Nothing is trained — see §2. Costs $0 to run — see §3.

Read this whole file, then `docs/HANDOFF.md` for the app it's landing on, before touching code.

---

## 1. What gets built

Three agent-facing features, all in `/inbox`:

1. **Draft with AI** — on a ticket, the agent clicks a button; a draft reply streams in, built
   from similar solved tickets and canned responses, with its sources listed. The agent edits it
   in the existing reply box before sending. **Nothing is ever sent automatically.**
2. **Suggested category/priority** — a chip on new tickets in the inbox ("Looks like Returns &
   Refunds, High — Accept / Dismiss"), from the ticket's own text.
3. **Summarize thread** — one click collapses a long ticket into a few lines, for a busy agent
   picking it up cold.

Customers never see or trigger any of this. It only runs for `agent`/`admin` viewers, enforced
the same way every other staff route in this app is (`requireApiRole(["agent", "admin"])`).

---

## 2. No training happens — how this actually works

Nothing here trains, fine-tunes, or updates any model. Two pretrained models are called over an
API, the same way `fetch` calls any other web service:

- **Groq** hosts open models (Llama 3.3 70B, etc.) and answers a request in under a second.
  This does the writing: drafts, summaries, category guesses.
- **A retrieval step** ("RAG" — retrieval-augmented generation) is what makes the answers
  Harborline-specific, with no training involved. Before asking Groq anything, the code:
  1. Turns the ticket's text into a vector (a list of numbers that captures its meaning) using
     an embedding model.
  2. Searches `knowledge_chunks` (§4) for the stored canned responses and past resolved
     solutions whose vectors are closest — literally the nearest points in that number space.
  3. Pastes the top few matches into the prompt sent to Groq: "Here's how similar tickets were
     solved before. Draft a reply to this one."

The model never "learns" any of this — it's re-reading your data fresh on every request, the
same way you'd paste three old tickets into a chat window before asking your question. Update a
canned response and the very next draft reflects it; a trained model would need retraining to
catch up, and this needs nothing.

---

## 3. Zero cost — the pieces and their free tiers

| Piece | Provider | Cost | Notes |
|---|---|---|---|
| Chat generation (drafts, summaries, triage) | Groq | Free, no card | Rate-limited, not usage-limited — see §5 |
| Embeddings (turning text into vectors) | Supabase Edge Functions' built-in `gte-small` model | Free, already included | Runs inside the Supabase project you already have; no external key |
| Fallback chat model | Google Gemini (`gemini-2.5-flash` or similar) | Free, no card | Used only if Groq is rate-limited |
| Per-visitor rate limiting | Upstash Redis | Free, no card | Optional but recommended — see §5 |

No payment method goes on any of these accounts. The worst case if a free tier is exhausted is
the feature going quiet with a "busy" message (§9 covers the fallback), never a bill.

---

## 4. Schema additions

One new table, `public.knowledge_chunks`, holding what gets retrieved:

```sql
create extension if not exists vector;

create table public.knowledge_chunks (
  id bigint generated always as identity primary key,
  source_type text not null check (source_type in ('canned_response', 'resolved_ticket')),
  source_id bigint not null,
  category public.ticket_category,
  content text not null check (char_length(content) between 1 and 4000),
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);

alter table public.knowledge_chunks enable row level security;

create policy "staff can read knowledge chunks"
  on public.knowledge_chunks for select
  to authenticated
  using (private.is_staff());
```

No insert/update policy for `authenticated` — chunks are only ever written by the backfill
script and a database trigger (step D), both running as the service role, which bypasses RLS by
design. `private.is_staff()` already exists (`supabase/migrations/20260915192308_...`); reuse it,
don't redefine it.

**What goes in it, and why it can't leak internal notes:** `canned_responses` (all of them — staff
authored, nothing customer-private) and staff-authored, non-internal messages on `resolved`
tickets only (`is_internal_note = false`). Internal notes are deliberately excluded from the
source data itself, not just filtered at read time — they never become a retrievable chunk, so
there's no path for one to surface in a customer-adjacent summary later.

---

## 5. Getting the API keys

### Groq (required)

1. Go to **console.groq.com** and sign up — no card needed for the free tier.
2. Left sidebar → **API Keys** → **Create API Key**. Copy it immediately; it's shown once.
3. Add to `.env.local`:
   ```
   GROQ_API_KEY=gsk_...
   ```
4. Check the **Limits** page in the console for the current per-minute and per-day request caps
   on the model you pick (they change — don't hard-code a number from this doc). Llama 3.3 70B
   is the usual pick for quality; a smaller/faster model is the usual pick if you hit limits.

### Gemini (recommended fallback)

1. Go to **aistudio.google.com/apikey**, sign in with a Google account.
2. **Create API key** — no card needed for the free tier.
3. Add to `.env.local`:
   ```
   GEMINI_API_KEY=...
   ```
4. Free-tier Gemini traffic may be used by Google to improve their models. Fine here — every
   ticket in this app is seed/demo data, never a real customer's.

### Upstash Redis (optional, for rate limiting)

1. Go to **console.upstash.com**, sign up free.
2. **Create Database** → Redis → pick a region close to your Vercel deployment's region →
   free tier.
3. Open the database → **REST API** tab → copy both values into `.env.local`:
   ```
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```

### Nothing to get for embeddings

Supabase Edge Functions expose a built-in inference session (`Supabase.ai.Session("gte-small")`)
that runs inside the function, no external call and no key. It's what step D and step F use.

---

## 6. New files (matches the existing `lib/api` + Zod + TanStack Query shape — see HANDOFF.md §6a)

```
supabase/
  migrations/
    <timestamp>_knowledge_chunks.sql          # §4, applied via the Supabase MCP like every other migration
    <timestamp>_knowledge_chunks_trigger.sql  # step D's auto-embed-on-resolve trigger
  functions/
    embed/index.ts                            # Edge Function: text -> 384-dim vector via gte-small
src/lib/ai/
  groq.ts             # Groq client: chat(), streamChat(), jsonChat() — mirrors lib/api/client.ts's shape
  gemini.ts           # Same surface as groq.ts, used only as a fallback
  retrieve.ts         # embed(text) -> call the Edge Function; retrieveContext(text, category, k)
  ratelimit.ts         # Upstash-backed daily caps per visitor (account + IP) and per account; no-ops if Upstash env vars are absent
  prompts.ts          # the three prompt templates (draft / triage / summary), plain exported strings
scripts/
  backfill-knowledge.ts  # one-off: embeds every existing canned_response + resolved ticket
src/app/api/tickets/[id]/ai/
  draft/route.ts      # POST, staff-only, streams
  triage/route.ts     # POST, staff-only, returns JSON
  summary/route.ts    # POST, staff-only, returns JSON
src/lib/api/schemas.ts     # add: aiDraftResponseSchema, aiTriageResponseSchema, aiSummaryResponseSchema
src/lib/queries/ai.ts      # useDraftReplyMutation, useTriageSuggestionQuery, useSummaryMutation
src/components/inbox/
  ai-draft-panel.tsx       # streaming draft + source chips + "Insert into reply"
  ai-triage-chip.tsx       # Accept / Dismiss suggestion
  ai-summary-card.tsx      # collapsible summary
```

---

## 7. Workflow — build one step at a time in Claude Code

Run `claude` from `C:\Users\Dell\Personal Projects\harborline`. Start each step with `/clear`;
this doc and `docs/HANDOFF.md` carry the context. Ask Claude to commit after each step passes.

### A. Orientation
> Read docs/HANDOFF.md and docs/AI-ASSIST.md in full. Summarize in 8 bullets: the three features, why nothing is "trained," the RLS boundary on knowledge_chunks, and the file list in section 6. No code.

**Done when:** the summary correctly explains RAG vs. training in its own words.

### B. Keys
> Confirm GROQ_API_KEY is in .env.local (I've added it — see AI-ASSIST.md section 5). Add GEMINI_API_KEY and the two UPSTASH_REDIS_REST_* vars as optional: the app must run with only GROQ_API_KEY set.

**Done when:** `npm run dev` starts with only `GROQ_API_KEY` set and no crash from the others being undefined.

### C. Schema
> Apply the knowledge_chunks migration from AI-ASSIST.md section 4 via the Supabase MCP, and mirror it to supabase/migrations/. Run get_advisors after and fix anything it flags.

**Done when:** `get_advisors` is clean and a manual insert as the `agent` demo account is rejected by RLS (only service-role writes).

### D. Embedding Edge Function + trigger
> Write supabase/functions/embed/index.ts: takes { text }, returns { embedding: number[] } via Supabase.ai.Session("gte-small"). Deploy it. Then write a database trigger: after a ticket_messages insert where is_internal_note = false and the ticket's status is 'resolved', call the embed function (via pg_net or a Supabase webhook) and insert the resulting chunk. Also embed every canned_responses row the same way, on insert/update.

**Done when:** resolving a ticket with a staff reply produces a new `knowledge_chunks` row within a few seconds, and editing a canned response re-embeds it.

### E. Backfill script
> Write scripts/backfill-knowledge.ts: embeds every existing canned_responses row and every non-internal staff message on an already-resolved ticket, skipping any (source_type, source_id) already in knowledge_chunks. Run it once.

**Done when:** `knowledge_chunks` has one row per canned response plus one per qualifying historical message, and running the script again inserts zero new rows.

### F. Groq + Gemini clients
> Write src/lib/ai/groq.ts and src/lib/ai/gemini.ts: chat() (JSON mode, for triage), streamChat() (for drafts), same function signatures on both so one can fall back to the other. Write src/lib/ai/retrieve.ts: embed() calls the Edge Function from step D; retrieveContext(text, category, k=4) does a cosine-similarity query against knowledge_chunks, scoped to the ticket's category when possible.

**Done when:** a one-off script call to `retrieveContext` on a real ticket's subject returns plausible matches, ranked.

### G. Rate limiting
> Write src/lib/ai/ratelimit.ts: a per-viewer (by user id) daily cap using Upstash, no-op (always allow) when the Upstash env vars are absent. If Upstash itself errors (unreachable, or the database is full; it is created with eviction off), fail open: allow the request and log the error once. Wire it into all three routes below, first.

**Done when:** exceeding the cap returns a 429 with a clear message; with no Upstash vars set, requests are never blocked; a forced Upstash error lets the request through.

### H. Draft route
> Write src/app/api/tickets/[id]/ai/draft/route.ts: staff-only (requireApiRole), fetches the ticket + its non-internal thread, calls retrieveContext, streams a drafted reply from Groq (falling back to Gemini on a Groq error), and sends the sources used as a header or a leading JSON line before the stream. Add the Zod response contract to schemas.ts per HANDOFF.md section 6a's pattern.

**Done when:** a curl/Playwright request as the agent demo account streams a draft that cites at least one real source; as the customer demo account it's a 403.

### I. Triage route
> Write src/app/api/tickets/[id]/ai/triage/route.ts: staff-only, one Groq call in JSON mode (structured output constrained to the real ticket_category/ticket_priority enum values from database.types.ts), returns { category, priority, confidence }.

**Done when:** it returns a valid enum value every time across 10 varied real tickets, never inventing a category.

### J. Summary route
> Write src/app/api/tickets/[id]/ai/summary/route.ts: staff-only, summarizes the ticket's non-internal thread in 3-4 sentences, includes internal notes only when the requesting viewer is staff (always true here, but keep the filter explicit and tested).

**Done when:** the summary reads accurately against 5 real seed tickets, checked by hand.

### K. Query hooks
> Write src/lib/queries/ai.ts per the existing pattern in src/lib/queries/tickets.ts: useDraftReplyMutation (handles the stream), useTriageSuggestionQuery, useSummaryMutation.

**Done when:** typecheck passes and the hooks follow the same shape as the existing ticket hooks.

### L. Draft UI
> Build src/components/inbox/ai-draft-panel.tsx in the inbox ticket detail: a "Draft with AI" button, a streaming text area, a row of source chips (canned response title or "ticket #1014"), and an "Insert into reply" action that fills the existing reply box without sending it. Match the design tokens in HANDOFF.md section 6c.

**Done when:** clicking it, editing the draft, and sending it end-to-end works, and nothing sends without the agent's own click on the existing send button.

### M. Triage UI
> Build src/components/inbox/ai-triage-chip.tsx on new tickets in the inbox list/detail: shows the suggestion with Accept (calls the existing PATCH /api/tickets/[id]) and Dismiss.

**Done when:** Accept updates the ticket's category/priority via the existing mutation, Dismiss just hides the chip, and it never appears on a ticket the agent already set manually.

### N. Summary UI
> Build src/components/inbox/ai-summary-card.tsx: collapsible, shown at the top of a ticket with more than 6 messages.

**Done when:** it matches the design tokens and doesn't shift layout when it loads.

### O. RLS and access tests
> Add to the existing test setup: a customer demo account hitting any /api/tickets/[id]/ai/* route gets 403 (or 401 signed out); confirm knowledge_chunks is unreadable via the Supabase client as the customer demo account; confirm an internal note never appears in knowledge_chunks (query it directly after step D/E).

**Done when:** all three pass, run against the real Supabase project.

### P. Fallback and empty states
> If both Groq and Gemini fail (or neither key is set), the draft panel shows "AI assist isn't available right now" instead of an error boundary; same for triage and summary. If Upstash isn't configured, rate limiting silently no-ops (already covered by step G, verify in the UI).

**Done when:** unsetting GROQ_API_KEY and GEMINI_API_KEY locally still renders a working inbox with a clear, calm "unavailable" state, no crash.

### Q. Update the docs
> Update docs/HANDOFF.md with a new section summarizing what AI Assist adds (mirror its existing style), and note the three new env vars in the project's env var documentation (add one if none exists).

**Done when:** a new session reading HANDOFF.md alone understands the feature exists and where its keys live.

---

## 8. What NOT to build

- No fine-tuning, no training job, no vector database beyond Postgres/pgvector (already free,
  already there — no reason to add Pinecone or similar).
- No auto-send. Every AI output is a suggestion an agent accepts, edits, or dismisses.
- No customer-facing AI. This stays entirely inside `/inbox`.
- No paid model tier. If Groq's free tier ever feels tight for a demo, drop to a smaller model
  before reaching for a paid one — this is a portfolio piece, not a product with real load.

# Harborline — AI Assist

An AI layer added to the existing agent inbox: drafts a reply from your own canned responses
and past resolved tickets, suggests a category/priority for new tickets, and summarizes long
threads. Nothing is trained — see §2. Costs $0 to run — see §3.

`docs/HANDOFF.md` covers the rest of the app.

---

## 1. What it does

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
script and the `embed` Edge Function (called by a database trigger), both running as the service role, which bypasses RLS by
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
that runs inside the function, no external call and no key. The `embed` Edge Function and `src/lib/ai/retrieve.ts` both rely on it.

---

## 6. Files

```
supabase/
  migrations/
    20260923192536_knowledge_chunks.sql          # §4: table, RLS, match function, tickets.triaged_at
    20260923192732_knowledge_chunks_trigger.sql  # keeps chunks in sync: resolve, reply, canned edit, delete
  functions/
    embed/index.ts                               # text -> 384-dim vector via gte-small; indexes sources
scripts/
  backfill-knowledge.ts        # one-off: embeds every existing canned response + resolved ticket
src/lib/ai/
  groq.ts, gemini.ts           # provider clients with the same surface (chat, streamChat)
  assist.ts                    # Groq first, Gemini as fallback; AiUnavailableError when neither works
  retrieve.ts                  # embed(text) via the Edge Function; retrieveContext(text, category, k)
  ratelimit.ts                 # Upstash daily caps per visitor (account + IP); no-op without Upstash
  prompts.ts                   # the draft / triage / summary prompts and JSON schemas
  thread.ts                    # which messages each feature may see, formatted for the prompt
  route.ts                     # shared preamble: staff guard, rate limit, RLS-scoped ticket load
src/app/api/tickets/[id]/ai/
  draft/route.ts               # POST, staff-only, streams
  triage/route.ts              # POST, staff-only, returns JSON
  summary/route.ts             # POST, staff-only, returns JSON
src/hooks/use-app-hooks/use-ai.tsx   # useTriageSuggestion (the draft and summary mutations live in their components)
src/components/inbox/
  ai-draft-panel.tsx           # streaming draft + source chips + "Insert into reply"
  ai-triage-chip.tsx           # Accept / Dismiss suggestion
  ai-summary-card.tsx          # collapsible summary
  ai-mark.tsx, ai-error-note.tsx   # the AI badge and the calm failure state
```

---

## 7. Deliberate limits

- No fine-tuning, no training job, no vector database beyond Postgres/pgvector (already free,
  already there — no reason to add Pinecone or similar).
- No auto-send. Every AI output is a suggestion an agent accepts, edits, or dismisses.
- No customer-facing AI. This stays entirely inside `/inbox`.
- No paid model tier. If Groq's free tier ever feels tight for a demo, drop to a smaller model
  before reaching for a paid one — this is a portfolio piece, not a product with real load.

# Harborline — Project notes

The as-built reference for Harborline: the decisions behind it, the schema, the architecture, and the known gaps. The README is the short version.

---

## 1. What this is

**Harborline**, "Customer support that keeps its word": a fictional two-sided support desk with a customer portal, an agent inbox and admin analytics, built on Next.js 16 and Supabase. It is a portfolio piece, not a real product: no real payments, no real email delivery, no real company.

---

## 2. Supabase project

- **Project ref:** `qgrkrrlccxtniuyflode` (`https://qgrkrrlccxtniuyflode.supabase.co`)
- **Migrations** (applied live, mirrored as files in `supabase/migrations/`; filename timestamps match the live versions):
  1. `20260915192308_harborline_core_schema.sql`: core tables, RLS, triggers, Storage bucket and policies, Realtime publication
  2. `20260915192719_english_only_content.sql`: drops the translate-on-write columns (see §3)
  3. `20260915193231_demo_seed_and_clock.sql`: reseedable demo fixture and nightly clock rebase
  4. `20260915201034_admin_analytics.sql`: the `admin_analytics()` RPC
  5. `20260923192536_knowledge_chunks.sql`: AI retrieval table, match function, `tickets.triaged_at` (§10a)
  6. `20260923192732_knowledge_chunks_trigger.sql`: keeps `knowledge_chunks` in sync (§10a)
  7. `20260924100000_security_hardening.sql`: demo identity lock, attachment path binding, embed secret, full nightly reset
- **Advisors:** no RLS or security errors. One non-blocking warning: leaked-password protection is off in Auth settings (see §9).

---

## 3. Key decisions (deviations from the original spec, on purpose)

| Area | Original spec | What was built |
|---|---|---|
| Domain | Unspecified | **E-commerce and logistics**: categories are order & delivery, returns & refunds, payments, account, product question |
| i18n | EN/FR switch, translate-on-write ticket content | **English only.** next-intl is wired (every UI string goes through `messages/en.json`), but there is no French catalog, no switcher and no translate-on-write. Ticket content is stored and shown as written. A French catalog can be added without refactoring. |
| Seed customers | 3 demo logins | 3 demo accounts **plus** 5 seed-only customers and 1 seed-only agent, so the cross-customer RLS tests have real data to bite on |
| Demo data freshness | Unspecified | A nightly `pg_cron` job restores the full fixture, so the demo always looks recent with a realistic SLA mix |

---

## 4. Database schema (as built, in `public` unless noted)

**Enums:** `user_role` (customer/agent/admin), `ticket_status` (new/in_progress/waiting_on_customer/resolved), `ticket_priority` (low/normal/high/urgent), `ticket_category` (order_delivery/returns_refunds/payments/account/product_question). An `app_locale` enum was created then dropped (see i18n decision above).

**Tables:**
- `profiles` (id → auth.users, full_name, role, created_at, updated_at) — `preferred_locale` column was dropped
- `sla_policies` (priority, first_response_minutes) — urgent=60, high=240, normal=480, low=1440
- `tickets` (id bigint identity starting at 1001, customer_id, subject, category, priority default normal, status default new, assigned_agent_id, order_reference, first_response_at, resolved_at, created_at, updated_at) — `subject_translations` and `locale` columns were dropped
- `ticket_messages` (id, ticket_id, author_id, body, is_internal_note, created_at) — `translations` and `locale` dropped
- `ticket_attachments` (id, ticket_id, message_id, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at)
- `canned_responses` (id, agent_id, title, body, created_at) — `locale` dropped
- `ticket_status_events` (id, ticket_id, from_status, to_status, changed_by, created_at) — **added beyond the original schema**, powers the ticket timeline and the "tickets by status over time" chart

**`private` schema** (not exposed via the Data API): `is_staff()`, `is_admin()`, `is_customer()` SECURITY DEFINER role-check helpers; `handle_new_user()` (creates a profile row on signup); `set_updated_at()`, `tickets_before_update()`, `log_ticket_status()`, `on_ticket_message_insert()` triggers (the last one auto-transitions ticket status: a staff reply on a `new` ticket flips it to `in_progress` and stamps `first_response_at`; a customer reply on `waiting_on_customer`/`resolved` reopens it to `in_progress`); `demo_clock` table + `seed_ticket()`/`reseed_demo()`/`rebase_demo_clock()` functions for the demo fixture (guarded by a `harborline.seeding` session setting so triggers don't double-log during seeding/rebasing).

**`public.admin_analytics(p_days integer default 30)`** — SECURITY INVOKER RPC, raises an exception for non-admins (enforced in the function body via `private.is_admin()`), returns jsonb: `totalTickets`, `respondedCount`, `avgFirstResponseMinutes`, `lateResponses`, `overdueOpen`, `byPriority[]`, `byCategory[]`, `statusDaily[]`.

**Storage:** one `ticket-attachments` bucket (private, 10MB limit, mime types png/jpeg/webp/gif/pdf/text-plain). RLS mirrors the table policies: folder-per-ticket, customers can only write into their own ticket's folder, staff can write/read anywhere.

**RLS:** enabled on every table plus `storage.objects`. Customers never see `is_internal_note = true` rows. Verified directly against the live API (not just hidden in the UI) — see §8.

**pg_cron:** job `harborline-demo-reset` runs `private.reset_demo()` nightly at 04:00 UTC: restores the demo display names, then `reseed_demo()` (the full fixture). It replaced the old `harborline-demo-rebase` job in `20260924100000_security_hardening.sql`, because the demo logins are public and a timestamp rebase alone never undid a visitor's changes.

**Demo account lock:** `private.demo_accounts` lists the seeded users; a trigger on `auth.users` silently keeps their password, email and phone, and one on `auth.mfa_factors` refuses MFA enrolment, so no visitor can lock the next one out. To change a demo password on purpose, remove the row, change it, re-insert.

---

## 5. Demo accounts

Password for all three real demo logins: **`harborline-demo-2026`**

| Role | Email | Name |
|---|---|---|
| Customer | customer@harborline.app | Maya Okafor |
| Agent | agent@harborline.app | Tomás Reyes |
| Admin | admin@harborline.app | Priya Raman |

Seed-only (no quick-login button, real but unremarkable passwords): jonah.whitfield@harborline.app (agent), ines.carvalho@example.com, marcus.bell@example.com, hana.sato@example.com, grace.adeyemi@example.com, oliver.brandt@example.com, leah.morrison@example.com (all customers).

**Seed data:** 22 tickets (#1001–1022) across every status/priority, ~60 messages, 6 internal notes, 6 canned responses. `select private.reseed_demo();` resets to this clean fixture at any time, and the nightly job does the same.

---

## 6. Architecture

**Stack:** Next.js 16 (App Router, Turbopack, React Compiler on), React 19.2, TypeScript, Tailwind CSS v4, next-intl 4, `@supabase/supabase-js` and `@supabase/ssr`, TanStack Query 5, Recharts 3, `@phosphor-icons/react`, Zod 4, react-hook-form.

**Auth:** Supabase Auth via `@supabase/ssr`: `src/lib/supabase/{client,server,proxy}.ts` and `src/proxy.ts` (Next 16 renamed `middleware.ts` to `proxy.ts`). `src/lib/auth.ts` exports `getViewer()` (React `cache()`-wrapped, validates the JWT with `getClaims()`) and `requireRole(roles)`. The protected prefixes `/portal`, `/inbox` and `/analytics` redirect to `/sign-in?next=...`. Sign-in and sign-out are server actions in `src/lib/actions/auth.ts`; everything else goes through the API below.

### 6a. Data layer: TanStack Query over a thin `/api`

- **Route handlers** under `src/app/api/` (see §7) call the same `src/lib/{tickets,inbox,analytics}.ts` functions the server-rendered pages use, so the API and the SSR path never duplicate query logic. `src/lib/api/guard.ts` provides `requireApiRole(roles)` / `requireApiViewer()` (a viewer or a ready-made 401/403) plus `parseBody()` / `parseIdParam()`. Request bodies are validated with the Zod input schemas in `src/lib/api/schemas.ts`; responses are returned as-is. Errors are codes (`{ error: "generic" | "forbidden" | "not_found" | ... }`) that the UI turns into translated messages.
- **Client:** `src/lib/api/instance.ts` exports `apiInstance` (`get` / `post` / `patch`), which rejects with a typed `ApiError(status, body)` on any non-2xx response.
- **Query hooks:** `src/hooks/use-app-hooks/use-{tickets,inbox,analytics,ai}.tsx`, one hook per read, with kebab-case query keys written inline.
- **Mutations** live in the component that triggers them and refetch the affected query on success. There are no optimistic updates and no manual cache patches.
- **First paint:** each page is a Server Component that calls `requireRole()`, prefetches its data with `prefetchQuery` and wraps a client component in `<HydrationBoundary>`. The client hook resolves from the hydrated cache, so first paint makes no `/api/*` request.
- **Query client:** `src/lib/query/client.ts` holds the shared defaults (`staleTime` 30 s, `gcTime` 24 h, no refetch on focus, `retry: 1`); `get-query-client.ts` gives each server request a fresh client; `browser-client.ts` is the browser singleton plus a `sessionStorage` persister, so the cache survives reloads within the tab. Sign-out (`src/components/app/sign-out-button.tsx`) clears both the cache and the persisted copy; `browser-client.ts` documents the short suppression window that stops the persister's throttled write from bringing it back.
- **Realtime:** `src/hooks/use-live-ticket.ts` (one ticket: messages, ticket updates, status events) and `src/components/inbox/inbox-provider.tsx` (the whole inbox: new tickets, status and assignment changes, new messages, unread badges). An event refetches the affected query through the same RLS-scoped API as every other read.

### 6b. Server-side data

- `src/lib/tickets.ts`: `getMyTicketsList()`, `getTicketDetail(id)` (RLS-scoped), `getTicketDetailForViewer(id, viewer)` (merges the full staff list into `people` for staff, so the assignment UI can always resolve a name), `getSlaTargets()`
- `src/lib/inbox.ts`: `getInboxTickets()`, `getStaff()`, `getCannedResponses()`
- `src/lib/analytics.ts`: `getAnalytics(days)` (calls the `admin_analytics` RPC)
- `src/lib/sla.ts`: pure functions, no React: `computeSla()`, `remainingFraction()`, `durationParts()`
- `src/lib/roles.ts`: `homeForRole()`, `isStaff()`
- `src/lib/time.ts`: `getRequestNow()` (`cache()`-wrapped, one timestamp per server request so every relative time on a page agrees)

### 6c. Design system (implemented in `src/app/globals.css`)

Tokens from the original spec, plus two derived ones it didn't specify:

| Token | Value | Note |
|---|---|---|
| `--bg` | `#FAF5EC` | |
| `--surface` | `#FFFFFF` | |
| `--surface-alt` | `#F1E9D8` | |
| `--ink` | `#241C14` | |
| `--ink-soft` | `#5B4E3F` | |
| `--ink-faint` | `#8B7E6C` | |
| `--border` | `#E4D9C3` | |
| `--accent` | `#0E5C4C` | teal |
| `--accent-soft` | `#DDEDE7` | |
| `--accent-ink` | `#083A30` | |
| `--warm` | `#C1571F` | coral |
| `--warm-soft` | `#F8E9DC` | **added** — the spec's `--warm` was too light for small text at AA contrast |
| `--warm-ink` | `#8F3D12` | **added**, same reason |
| `--success` / `--warning` / `--danger` | `#3F7D4A` / `#B8863A` / `#A63A2E` | |

- **Fonts:** Bricolage Grotesque (display, `wdth` axis only, `display: "optional"` — deliberately, to avoid layout shift from a late font swap), Public Sans (body), JetBrains Mono (data/mono, `preload: false`). All self-hosted via `next/font`, no runtime Google Fonts link.
- **Shape:** 8px radius on cards/panels, full-pill on badges/buttons — one scale, no mixing.
- **Chart colors deliberately differ from the UI tokens.** The raw `--accent`/`--warm` failed the dataviz-skill palette validator's chroma-floor check when used as large chart fills. Documented in `src/lib/chart-colors.ts`: status chart uses `#D09A2C` (new) / `#23A383` (in_progress) / `#D4602A` (waiting) / `#00806A` (resolved); category chart uses `#D4602A` (open) / `#00806A` (resolved).
- **Logo:** custom mark, not a stock logo. `src/components/brand/logo-mark.tsx` — a teal rounded tile with a cream "H" formed from two mooring posts, tied together by a coral horizontal line. Favicon at `src/app/icon.svg`, Apple touch icon generated at build time via `next/og` `ImageResponse` in `src/app/apple-icon.tsx`. `Wordmark` component pairs the mark with "Harborline" in the display font.

### 6d. Notable UI components

- `src/components/ui/sla-badge.tsx` — **the pill itself is the gauge**, not a separate progress bar next to it. A `color-mix` fill drains left-to-right behind a Timer/Warning icon as the response-time clock runs down: green → amber → coral → red, ending empty-and-red once overdue. Answered tickets show a flat "Replied in Xm" / "Replied in Xm, past target" state with a check icon and no fill.
- `src/components/ui/priority-label.tsx` — a 4-bar signal icon (like a signal-strength indicator): filled-bar count = priority level, colored per level (low = 1 bar green, normal = 2 amber, high = 3 coral, urgent = 4 red).
- `src/components/app/sidebar.tsx` — collapsible desktop sidebar; the collapsed/expanded state is stored in a `harborline-sidebar` cookie so the server renders the correct width on first paint (no flash of the wrong state).
- `src/components/app/app-nav.tsx`, `app-shell.tsx`, `mobile-nav.tsx`: shared nav, shell and mobile menu.

---

## 7. Route map

```
/                              landing (public)
/sign-in                       sign-in, incl. the 3 demo quick-login buttons
/portal                        customer: "my tickets" list (?tab=open|resolved)
/portal/new                    customer: multi-step new-ticket wizard
/portal/tickets/[id]           customer: ticket detail + reply
/inbox                         agent/admin: inbox list + empty detail state
/inbox/[id]                    agent/admin: ticket detail + reply/note/status/assign
/analytics                     admin: charts + stats + response-target table
/api/tickets                   GET list (customer) / POST create
/api/tickets/[id]              GET detail / PATCH update (staff)
/api/tickets/[id]/messages     POST reply or note
/api/tickets/[id]/attachments  POST record uploaded-file metadata
/api/tickets/[id]/ai/draft     POST streamed draft reply (staff, §10)
/api/tickets/[id]/ai/triage    POST suggested category/priority (staff, §10)
/api/tickets/[id]/ai/summary   POST thread summary (staff, §10)
/api/inbox                     GET (staff)
/api/staff                     GET (staff)
/api/canned-responses          GET (staff)
/api/sla-policies              GET (any signed-in viewer)
/api/analytics                 GET (admin)
```

---

## 8. How it is verified

- **Automated:** `npm test` (Vitest, 24 tests) runs against the real Supabase project and a server on port 3100: AI route access by role (`tests/ai-access.test.ts`), the rate limiter (`tests/ai-ratelimit.test.ts`), which messages each AI feature may read (`tests/ai-thread.test.ts`) and the post-sign-in redirect guard (`tests/safe-next.test.ts`). `tsc --noEmit`, `eslint .` and `next build` are clean.
- **RLS,** tested against both the Supabase client and the `/api` routes, not just hidden in the UI: a customer gets 403 from every staff or admin route, 200 from their own ticket and a plain 404 (not a permission leak) for another customer's ticket. Storage: an own-folder upload succeeds; cross-customer and anonymous uploads are rejected.
- **In the browser:** all three demo logins; a customer reply appearing live in the agent's open ticket; the new-ticket wizard end to end (create, direct-to-Storage upload, attachment recorded, file in the thread); sign-out clearing the persisted cache.

## 9. Known gaps

1. **Lighthouse LCP** is over the 2.5 s target on signed-in routes (about 3.5 to 3.8 s simulated), traced to per-query latency between the machine and the Supabase region, not to the client. The landing page is fast (about 0.3 s unthrottled LCP), and CLS is 0 everywhere thanks to the display font's `display: "optional"`.
2. **Not built:** dark mode, a canned-response management UI (add and edit your own snippets), and a second language.
3. **Leaked-password protection** is off in Supabase Auth settings; turn it on before anything production-facing.
4. A few test files from early RLS testing may remain in the `ticket-attachments` bucket. SQL can't delete Storage objects, so remove them from the Storage dashboard if it matters.

---

## 10. AI Assist

Three agent-facing features, all staff-only (`requireApiRole(["agent", "admin"])`), all inside `/inbox`. Customers never see or trigger any of it. `docs/AI-ASSIST.md` explains how it works and why nothing is trained; this section covers what was built.

- **Draft with AI** (`ai-draft-panel.tsx`) — streams a suggested reply built from the ticket's public thread plus the nearest canned responses and resolved-ticket replies (RAG via `knowledge_chunks`, §10a). Lists its sources as chips. Inserting over existing composer text asks for confirmation first (`ConfirmDialog`, tone `danger`); nothing ever sends without the agent's own click on the existing Send button.
- **Suggested category/priority** (`ai-triage-chip.tsx`) — one Groq call, made once per ticket per session, only on `status = 'new'` tickets, only in the ticket detail (not the list, to stay well inside the free-tier rate limit). Accept goes through the same `PATCH /api/tickets/[id]` as a manual change. A new `tickets.triaged_at` column (stamped by a trigger whenever category/priority changes with a signed-in `auth.uid()`) is what makes the chip never reappear once a human — or Accept — has already set it; seeding and the nightly clock rebase run with no `auth.uid()`, so they never stamp it.
- **Summarize thread** (`ai-summary-card.tsx`) — shown on tickets with 4+ messages (the original spec said more than 6; lowered so it shows on the seed data). Internal notes are included in the summary only for staff viewers, enforced explicitly in `src/lib/ai/thread.ts` rather than assumed from the route guard.

### 10a. Retrieval (RAG, not training)

- `public.knowledge_chunks` (migration `20260923192536`) — `source_type` (`canned_response` | `resolved_ticket`), `source_id`, `category`, `content`, `embedding vector(384)`, unique on `(source_type, source_id)` so re-embedding is an upsert. RLS: staff `select` only, no `insert`/`update`/`delete` policy for any client role — every write goes through the `embed` Edge Function running as the service role. `public.match_knowledge_chunks()` (SECURITY INVOKER) does the cosine-similarity search, so a customer calling it gets an empty set rather than an error that would confirm the table exists.
- `supabase/functions/embed` — Deno Edge Function, `Supabase.ai.Session("gte-small")`, two modes: `{ text }` → a query embedding (staff JWT required), `{ index: {...} }` → embeds one canned response or one qualifying ticket message and upserts it (requires the Vault secret `harborline_embed_secret` in `x-embed-secret`, which `private.request_embedding` sends, or a staff JWT, which the backfill script sends; it re-derives eligibility itself from the service-role read, so a caller can at most trigger an idempotent re-index of a row that already belongs in the table — it can never inject content, and an internal note can never become a chunk). Deployed with `verify_jwt: false` because the database triggers call it with no user JWT.
- Migration `20260923192732` wires the triggers: a staff reply landing on an already-resolved ticket, a ticket flipping to `resolved`, and any canned-response insert/update/delete, all via `pg_net` (async, fire-and-forget, only sent if the transaction commits — an embedding failure can never block a reply or a status change). `TRUNCATE` on `ticket_messages`/`canned_responses` (i.e. `private.reseed_demo()`) drops the matching chunks inline; confirmed live that reseeding self-heals `knowledge_chunks` back to a clean 19-row state (6 canned + 13 resolved-ticket messages) with no backfill run needed, because the seed function inserts messages after the ticket already has its target status, so the insert-time trigger catches it.
- `scripts/backfill-knowledge.ts` — one-off/idempotent, signs in as the agent demo account, calls the same Edge Function per missing `(source_type, source_id)`. `npm run backfill:knowledge`.
- Retrieval similarity floor is `0.78` (`src/lib/ai/retrieve.ts`), calibrated against the live seed data: gte-small puts almost any two English support messages at ~0.70–0.72, genuinely related sources land at ~0.79–0.85.

### 10b. Model layer

- `src/lib/ai/groq.ts` / `gemini.ts` — same `ChatProvider` surface (`chat()` JSON mode, `streamChat()`), so `src/lib/ai/assist.ts` falls back Groq → Gemini on any failure, and a JSON reply that fails Zod validation counts as a failure (the next provider is tried rather than a caller ever seeing a value outside the real enum). Model: `openai/gpt-oss-120b` on Groq (`GROQ_MODEL` to override) — Llama 3.3 70B isn't offered on this account's free tier; gpt-oss-120b supports strict JSON-schema output and answers in under a second. Gemini fallback is wired but **no `GEMINI_API_KEY` is set**; the app runs on Groq alone and degrades to the calm "unavailable" state if Groq fails, per spec.
- `src/lib/ai/ratelimit.ts` — Upstash REST, two `INCR`s per request per UTC day: per visitor, i.e. account + client IP (`AI_DAILY_LIMIT`, default 30), and per account across IPs (`AI_ACCOUNT_DAILY_LIMIT`, default 300), because the demo staff logins are shared by every hirer. No Upstash vars → no-op. Upstash error (unreachable, bad credentials, database full) → fails open, logs once per process. Verified live: a forced `AI_DAILY_LIMIT=1` run showed the third call return 429 with the inline "You've used today's AI assist allowance" message and no crash.
- Prompts (`src/lib/ai/prompts.ts`) explicitly tell the draft model the reference material is *other tickets'* history, not this ticket's — an earlier version, without that line, would sometimes narrate a saved reply's action ("I've emailed you a label") as already having happened on the current ticket. Fixed by stating the last-speaker situation (agent waiting on customer vs. customer waiting on a reply) directly in the prompt.

### 10c. UI additions that came with it

A confirmation-dialog system (`src/components/ui/confirm-dialog.tsx`, native `<dialog>`, no focus-trap library), a toast system (`src/components/ui/toaster.tsx`, top-right, errors linger longer), and wired both into existing flows that previously acted with no assurance step or feedback: sign-out now confirms first (`sign-out-button.tsx`), resolving a ticket confirms first (it tells the customer the problem is closed), and every reply/note/status/assignment/priority change and AI action now toasts a result. `buttonClass` gained a `danger` variant (white on `--danger`, 6.1:1) for destructive confirms.

### 10d. Verified live

- Draft, triage, and summary all tested end-to-end as the agent demo account on real tickets; customer and signed-out requests to all three `/api/tickets/[id]/ai/*` routes confirmed 403/401.
- `knowledge_chunks` confirmed unreadable and unwritable via the Supabase client as both the customer and agent demo accounts (only the service role writes); confirmed zero internal-note content ever appears in a chunk, checked directly against the live table.
- Triage evaluated against 10 real seed tickets: category matched the human-assigned category 10/10; priority matched 6/10, every miss one level off.
- Unavailable state (`GROQ_API_KEY`/`GEMINI_API_KEY` both unset) confirmed live: inbox renders normally, both the triage chip and draft panel show the calm "AI assist isn't available right now" note, no crash.

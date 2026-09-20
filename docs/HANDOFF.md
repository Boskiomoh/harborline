# Harborline — Project Handoff / Context

Paste this whole file into a new chat so it has full context on the project without re-deriving anything from scratch. Written 2026-09-16, mid-build (through Phase 6 of the original workflow, plus a later architecture change — see below).

---

## 1. What this is

**Harborline** — "Customer support that keeps its word." Fourth piece in Daniel Omoyibo's Upwork portfolio (alongside Clearway, Brightpath, Fenn Audio). A fictional two-sided support-desk SaaS: a customer portal + an agent inbox + admin analytics, built on Next.js 16 + Supabase, designed to showcase the real Nobus Cloud skill combo (a production support portal, i18n architecture) without literally reusing that i18n scope (see decision log).

Full requirements are in two files at the project root: **`Harborline-PRD.md`** and **`Harborline-WORKFLOW.md`**. Read those for the original spec — this document is the delta of what was actually decided and built, which in a few places differs from the original PRD (all deviations are called out below).

**Owner:** Daniel Omoyibo (ofolafolu@gmail.com). This is a portfolio piece, not a real product — no real payments, no real email delivery, no real company.

**Local path:** `C:\Users\Dell\Personal Projects\harborline`
**OS:** Windows 11, PowerShell primary shell, Git Bash also available.
**Not yet a git repo.**

---

## 2. Supabase project

- **Project ref:** `qgrkrrlccxtniuyflode`
- **URL:** `https://qgrkrrlccxtniuyflode.supabase.co`
- **⚠️ This project was reused, not created fresh.** It previously held a different portfolio piece's data (a sneaker product, "VELOCE UNO"). The user explicitly said to wipe and reuse it rather than create a new project (deviates from the PRD's "dedicated project" instruction — this was a conscious user decision, not an oversight). The original data is backed up at `Personal Projects/_backups/supabase-qgrkrrlccxtniuyflode-veloce-2026-09-15.json`.
- **Migrations** (applied live via the Supabase MCP, and mirrored as files in `supabase/migrations/`):
  1. `20260915192308_harborline_core_schema.sql` — core tables, RLS, triggers, Storage bucket+policies, Realtime publication
  2. `20260915192719_english_only_content.sql` — drops the translate-on-write columns (see §4)
  3. `20260915193231_demo_seed_and_clock.sql` — reseedable demo fixture + nightly clock rebase
  4. `20260915201034_admin_analytics.sql` — the `admin_analytics()` RPC
  - No migration exists for the later TanStack Query work (§6) — that was frontend-only, no schema changes.
- **`get_advisors`**: no RLS/security errors. One non-blocking WARN: leaked-password-protection is disabled in Auth settings (not fixed — low priority for a demo with known credentials, but worth flipping on in the dashboard before a real launch).

---

## 3. Key decisions (deviations from the original PRD — do not "fix" these back)

These were explicit user answers to `AskUserQuestion` prompts, not assumptions:

| Area | PRD said | What was actually built |
|---|---|---|
| Supabase project | New, dedicated project | Reused/wiped `qgrkrrlccxtniuyflode` (see §2) |
| Domain | Unspecified/cloud-hosting-flavored | **E-commerce/logistics** — categories are order & delivery, returns & refunds, payments, account, product question |
| i18n | Real EN/FR switch, translate-on-write ticket content | **English-only.** next-intl is wired (all UI strings go through `messages/en.json`), but there is no French catalog, no switcher, and no translate-on-write. Ticket content is stored and shown as written. A French catalog could be added later without refactoring, but wasn't built. |
| Seed customers | Not specified beyond 3 demo logins | 3 demo accounts **plus** 5 more seed-only customers and 1 more seed-only agent, so RLS cross-customer tests have real data to bite on |
| Demo data freshness | Not specified | A `pg_cron` job re-bases every seed timestamp nightly at 04:00 UTC, so the demo always looks "recent" with a realistic SLA mix |
| Checkpoints | Not specified | User asked to build through Phase 6, then check in before Phase 7 (deploy) — **deploy has not happened yet** |

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
- `ticket_status_events` (id, ticket_id, from_status, to_status, changed_by, created_at) — **added beyond the PRD's schema**, powers the ticket timeline and the "tickets by status over time" chart

**`private` schema** (not exposed via the Data API): `is_staff()`, `is_admin()`, `is_customer()` SECURITY DEFINER role-check helpers; `handle_new_user()` (creates a profile row on signup); `set_updated_at()`, `tickets_before_update()`, `log_ticket_status()`, `on_ticket_message_insert()` triggers (the last one auto-transitions ticket status: a staff reply on a `new` ticket flips it to `in_progress` and stamps `first_response_at`; a customer reply on `waiting_on_customer`/`resolved` reopens it to `in_progress`); `demo_clock` table + `seed_ticket()`/`reseed_demo()`/`rebase_demo_clock()` functions for the demo fixture (guarded by a `harborline.seeding` session setting so triggers don't double-log during seeding/rebasing).

**`public.admin_analytics(p_days integer default 30)`** — SECURITY INVOKER RPC, raises an exception for non-admins (enforced in the function body via `private.is_admin()`), returns jsonb: `totalTickets`, `respondedCount`, `avgFirstResponseMinutes`, `lateResponses`, `overdueOpen`, `byPriority[]`, `byCategory[]`, `statusDaily[]`.

**Storage:** one `ticket-attachments` bucket (private, 10MB limit, mime types png/jpeg/webp/gif/pdf/text-plain). RLS mirrors the table policies: folder-per-ticket, customers can only write into their own ticket's folder, staff can write/read anywhere.

**RLS:** enabled on every table plus `storage.objects`. Customers never see `is_internal_note = true` rows. Verified directly against the live API (not just hidden in the UI) — see §8.

**pg_cron:** job `harborline-demo-rebase` runs `private.rebase_demo_clock()` nightly at 04:00 UTC.

---

## 5. Demo accounts

Password for all three real demo logins: **`harborline-demo-2026`**

| Role | Email | Name |
|---|---|---|
| Customer | customer@harborline.app | Maya Okafor |
| Agent | agent@harborline.app | Tomás Reyes |
| Admin | admin@harborline.app | Priya Raman |

Seed-only (no quick-login button, real but unremarkable passwords): jonah.whitfield@harborline.app (agent), ines.carvalho@example.com, marcus.bell@example.com, hana.sato@example.com, grace.adeyemi@example.com, oliver.brandt@example.com, leah.morrison@example.com (all customers).

**Seed data:** 22 tickets (#1001–1022) across every status/priority, ~60 messages, 6 internal notes, 6 canned responses. **Note:** a couple of extra tickets (#1023, #1024) were created during QA/testing and are still in the database — run `select private.reseed_demo();` (via the Supabase MCP or SQL editor) before final delivery to reset to the clean 22-ticket fixture.

---

## 6. Architecture as built

**Stack:** Next.js 16.3.5 (App Router, Turbopack), React 19.2.8, TypeScript, Tailwind CSS v4, next-intl 4.14.5, `@supabase/supabase-js` 2.116.0, `@supabase/ssr` 0.12.7, Recharts 3.10.1, `@phosphor-icons/react` 2.1.10, Zod 4.6.5, `react-hook-form` 7.88.0, `@hookform/resolvers` 5.9.1. Recently added: `@tanstack/react-query` 5.103.1 + `@tanstack/react-query-devtools` + `@tanstack/query-async-storage-persister` + `@tanstack/react-query-persist-client` (all pinned to 5.103.1).

**Auth:** Supabase Auth via `@supabase/ssr`. `src/lib/supabase/{client.ts,server.ts,proxy.ts}`, `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`). `src/lib/auth.ts` exports `getViewer()` (React `cache()`-wrapped, validates the JWT via `getClaims()`) and `requireRole(roles)`. Protected prefixes: `/portal`, `/inbox`, `/analytics` — redirect to `/sign-in?next=...` if not authorized.

**Server actions kept as-is:** `src/lib/actions/auth.ts` (`signIn`, `signInAsDemo`, `signOut`). `src/lib/actions/tickets.ts` was **deleted** — all ticket mutations moved to the API layer described below.

### 6a. The TanStack Query + Zod API layer (added late in the build, on explicit user request)

The user asked, in a later message, to introduce TanStack Query with a Zod-validated `/api` layer and session-persisted caching, specifically so the frontend doesn't refetch from the backend on every navigation. A `/loop`-free workflow was proposed and approved before building it. What exists now:

- **Contract:** `src/lib/api/schemas.ts` — every shape (tickets, messages, events, attachments, inbox rows, analytics, mutation inputs) is a Zod schema. Route handlers validate their response against it before sending; client hooks parse the fetch response with the same schema. One shared source of truth.
- **API client:** `src/lib/api/client.ts` — `apiFetch<T>(url, schema, init)` throws a typed `ApiError` on any non-2xx response.
- **Server guard:** `src/lib/api/guard.ts` — `requireApiRole(roles)` / `requireApiViewer()` return either the viewer or a ready-made 401/403 `NextResponse`; `parseBody()` / `parseIdParam()` for request validation.
- **Route handlers** under `src/app/api/`:
  - `tickets/route.ts` — GET (customer's own list) / POST (create ticket, customer-only)
  - `tickets/[id]/route.ts` — GET (detail, RLS-scoped) / PATCH (status/priority/assignee, staff-only)
  - `tickets/[id]/messages/route.ts` — POST (reply or internal note, optional status change)
  - `tickets/[id]/attachments/route.ts` — POST (records metadata for a file the browser already uploaded **directly to Supabase Storage** — uploads deliberately stay off the API, per explicit decision, to avoid proxying file bytes through a serverless function with a request-size limit)
  - `inbox/route.ts`, `staff/route.ts`, `canned-responses/route.ts` (all staff-only), `sla-policies/route.ts` (any signed-in viewer), `analytics/route.ts` (admin-only)
  - Every handler calls the **same** `src/lib/{tickets,inbox,analytics}.ts` data functions the server-rendered pages use for prefetching — no duplicated query logic between the API and the SSR path.
- **Query client:**
  - `src/lib/query/client.ts` — shared defaults (`staleTime: 30s`, `gcTime: 24h`, `refetchOnWindowFocus: false`, `retry: 1`)
  - `src/lib/query/get-query-client.ts` — server-only, React `cache()`-wrapped, one fresh `QueryClient` per request, used only for `prefetchQuery` + `dehydrate` in Server Components
  - `src/lib/query/keys.ts` — the `qk` key factory (`qk.myTickets()`, `qk.ticket(id)`, `qk.inbox()`, `qk.staff()`, `qk.cannedResponses()`, `qk.slaPolicies()`, `qk.analytics(days)`)
  - `src/lib/query/browser-client.ts` — the browser-side singleton `QueryClient` + a `sessionStorage`-backed persister. **Session persistence:** the cache survives reloads within the tab and is wiped on sign-out. There's a documented fix in here for a real race condition: the persister's own throttled write (default 1s) could resurrect an empty cache entry in `sessionStorage` right after sign-out's `removeClient()` call; fixed with a short suppression window.
- **Provider:** `src/components/providers/query-provider.tsx` (`PersistQueryClientProvider`), mounted in `src/app/layout.tsx` inside `NextIntlClientProvider`.
- **Query/mutation hooks:**
  - `src/lib/queries/tickets.ts` — `useMyTicketsQuery`, `useTicketDetailQuery`, `useCreateTicketMutation`, `usePostMessageMutation`, `useUpdateTicketMutation`, `useRecordAttachmentMutation` — plus shared cache-patch helper functions (`appendTicketMessage`, `patchTicketCore`, `appendTicketEvent`, `mergeTicketPeople`, `prependMyTicket`) used by **both** the mutations' `onSuccess`/`onMutate` handlers **and** the Realtime subscriptions, so there's one code path for "a message/status/event landed, patch the cache."
  - `src/lib/queries/inbox.ts` — `useInboxQuery`, `useStaffQuery`, `useCannedResponsesQuery`, `useSlaPoliciesQuery`, `patchInboxList`
  - `src/lib/queries/analytics.ts` — `useAnalyticsQuery(days)`
- **The pattern used on every page:** a Server Component does `requireRole()` + `queryClient.prefetchQuery(...)` (or `getX(id)` directly + `setQueryData` when the result needs inspecting for a 404 first) + `dehydrate(queryClient)`, wrapping a client component in `<HydrationBoundary>`. The client component calls the matching `useQuery` hook, which resolves from the already-hydrated cache — **zero client-side fetch on first paint.** Confirmed in the browser via the network tab on every route (portal list, ticket detail, inbox, inbox ticket, analytics): only the RSC navigation request fires, no `/api/*` call.
- **Realtime** now patches the Query cache directly via `queryClient.setQueryData()` instead of holding its own `useState` — see `src/components/tickets/use-live-ticket.ts` (per-ticket subscription: messages, ticket updates, status events) and `src/components/inbox/inbox-provider.tsx` (inbox-wide subscription: new tickets, status/assignment changes, new messages, unread badges).
- **Sign-out:** `src/components/app/sign-out-button.tsx` clears the in-memory Query cache and the persisted `sessionStorage` copy (with the race-condition fix above) before calling the `signOut` server action.

### 6b. Data layer (server-side)

- `src/lib/tickets.ts` — `getMyTicketsList()`, `getTicketDetail(id)` (RLS-scoped raw fetch), `getTicketDetailForViewer(id, viewer)` (merges the full staff list into `people` for staff viewers, so the assignment UI can always resolve a name even for staff who haven't posted yet), `getSlaTargets()`
- `src/lib/inbox.ts` — `getInboxTickets()`, `getStaff()`, `getCannedResponses()`
- `src/lib/analytics.ts` — `getAnalytics(days)` (calls the `admin_analytics` RPC)
- `src/lib/sla.ts` — pure functions, no React: `computeSla()`, `remainingFraction()`, `durationParts()`
- `src/lib/roles.ts` — `homeForRole()`, `isStaff()`
- `src/lib/time.ts` — `getRequestNow()` (React `cache()`-wrapped, one timestamp per server request so every relative-time label on a page agrees)

### 6c. Design system (implemented in `src/app/globals.css`)

Tokens exactly per PRD §3, plus two derived tokens the PRD didn't specify:

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
| `--warm-soft` | `#F8E9DC` | **added** — PRD's `--warm` was too light for small text at AA contrast |
| `--warm-ink` | `#8F3D12` | **added**, same reason |
| `--success` / `--warning` / `--danger` | `#3F7D4A` / `#B8863A` / `#A63A2E` | |

- **Fonts:** Bricolage Grotesque (display, `wdth` axis only, `display: "optional"` — deliberately, to avoid layout shift from a late font swap), Public Sans (body), JetBrains Mono (data/mono, `preload: false`). All self-hosted via `next/font`, no runtime Google Fonts link.
- **Shape:** 8px radius on cards/panels, full-pill on badges/buttons — one scale, no mixing.
- **Chart colors deliberately differ from the UI tokens.** The raw `--accent`/`--warm` failed the dataviz-skill palette validator's chroma-floor check when used as large chart fills. Documented in `src/lib/chart-colors.ts`: status chart uses `#D09A2C` (new) / `#23A383` (in_progress) / `#D4602A` (waiting) / `#00806A` (resolved); category chart uses `#D4602A` (open) / `#00806A` (resolved).
- **Logo:** custom mark, not a stock logo (per PRD). `src/components/brand/logo-mark.tsx` — a teal rounded tile with a cream "H" formed from two mooring posts, tied together by a coral horizontal line. Favicon at `src/app/icon.svg`, Apple touch icon generated at build time via `next/og` `ImageResponse` in `src/app/apple-icon.tsx`. `Wordmark` component pairs the mark with "Harborline" in the display font.

### 6d. Notable UI components

- `src/components/ui/sla-badge.tsx` — **the pill itself is the gauge**, not a separate progress bar next to it (explicit user correction mid-build). A `color-mix` fill drains left-to-right behind a Timer/Warning icon as the response-time clock runs down: green → amber → coral → red, ending empty-and-red once overdue. Answered tickets show a flat "Replied in Xm" / "Replied in Xm, past target" state with a check icon and no fill.
- `src/components/ui/priority-label.tsx` — a 4-bar signal icon (like a signal-strength indicator): filled-bar count = priority level, colored per level (low = 1 bar green, normal = 2 amber, high = 3 coral, urgent = 4 red).
- `src/components/app/sidebar.tsx` — collapsible desktop sidebar; the collapsed/expanded state is stored in a `harborline-sidebar` cookie so the server renders the correct width on first paint (no flash of the wrong state).
- `src/components/app/app-nav.tsx`, `app-shell.tsx` — shared nav/shell, mobile menu.

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
/api/inbox                     GET (staff)
/api/staff                     GET (staff)
/api/canned-responses          GET (staff)
/api/sla-policies              GET (any signed-in viewer)
/api/analytics                 GET (admin)
```

---

## 8. Verified so far (all via live browser testing with Playwright, not assumed)

- All three demo logins work and show a fully populated product.
- **RLS, tested directly against both the Supabase client and the new `/api` routes** (not just hidden in the UI): a customer gets 403 from every staff/admin-only route, 200 from their own ticket, and a plain 404 (not a permission leak) for another customer's ticket. Storage upload policies also tested (own-folder upload succeeds, cross-customer folder and anonymous upload both rejected).
- Realtime: replying as the customer in one tab appears live in the agent's open ticket in another, with **zero client-side fetch** — confirmed by patching the TanStack Query cache directly from the Realtime payload.
- Every server-rendered route (portal list, ticket detail, inbox, inbox ticket, analytics) hydrates from the server prefetch with no client-side `/api/*` request on first paint — confirmed via the network tab.
- The new-ticket wizard's full flow works end to end: create → direct-to-Storage upload → attachment metadata recorded via the API → thread shows the file.
- An optimistic mutation (e.g. assigning a ticket) updates both the open ticket detail pane and the corresponding inbox row from a single request.
- Sign-out fully clears the persisted `sessionStorage` cache (verified after fixing the persist-throttle race described in §6a).
- `get_advisors` shows no RLS/security errors.
- Zero dark-background sections anywhere.
- `tsc --noEmit` and `eslint` are both clean. A full `next build` succeeds.

## 9. Not yet done / known gaps

1. **Test data cleanup:** run `select private.reseed_demo();` to remove the QA-created tickets (#1023, #1024) and reset to the clean 22-ticket fixture. Also 2–3 small test files are sitting in the `ticket-attachments` Storage bucket from RLS testing — remove via the Storage dashboard (SQL can't delete Storage objects).
2. **Lighthouse LCP** is over the 2.5s target on signed-in routes (~3.5–3.8s simulated), traced to ~0.5–0.7s per-query latency from this dev machine to the Supabase project's region — **not** something the TanStack Query work fixes (that was about avoiding *repeat* requests, not first-load latency). Expected to improve once deployed to Vercel in the same region as Supabase. The landing page itself is fast (~0.3s unthrottled LCP). CLS is 0 everywhere (fixed earlier via the font's `display: "optional"`).
3. **Stretch items not built:** dark mode toggle, canned-response management UI (add/edit own snippets), a second language beyond the i18n-ready English-only setup.
4. **Leaked-password-protection** is off in Supabase Auth settings — flip on in the dashboard if this ever needs to look production-hardened.
5. **Phase 7 (deploy) hasn't started.** Needs: which Vercel account/team to deploy to, and whether to create a GitHub repo (name, public/private). The project isn't a git repo yet.
6. Haven't re-run a full Lighthouse pass since the TanStack Query migration (expected to help repeat-navigation perf, not change the SSR-per-navigation first-load numbers).

---

## 10. Working conventions established this session

- User wants to be **asked, not guessed at**, for anything genuinely ambiguous (domain choices, architecture trade-offs) — multiple rounds of `AskUserQuestion` were used and are the source of §3's decisions.
- User corrects imprecise UI implementations directly and expects the fix to match their exact framing (e.g. "the pill itself is the gauge, not a bar next to it").
- Every schema change goes through the Supabase MCP (`apply_migration`) live, and is **also** written to `supabase/migrations/` as a file for the repo, with the filename's timestamp matching the live migration version.
- Verification is done live in a real browser (Playwright MCP) against the running dev server on port 3100, not just by reading code — network tab, console errors, and screenshots are checked after every meaningful change.
- Production builds are spot-checked on port 3200 when performance or build-correctness is in question.

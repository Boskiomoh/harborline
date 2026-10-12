# Harborline

**Customer support that keeps its word.**

Harborline is a two-sided customer-support desk: a customer portal for submitting and tracking tickets, an agent inbox for responding to them, and an admin analytics dashboard for tracking SLA performance. It's a portfolio piece — a fictional product, no real payments or company behind it — built to demonstrate a production-grade support-desk architecture end to end.

## Live demo

Sign in with any of the three quick-login buttons on the sign-in page, or use these credentials directly:

| Role | Email | Password |
|---|---|---|
| Customer | `customer@harborline.app` | `harborline-demo-2026` |
| Agent | `agent@harborline.app` | `harborline-demo-2026` |
| Admin | `admin@harborline.app` | `harborline-demo-2026` |

## Features

- **Customer portal** — multi-step ticket wizard, ticket list with status filters, threaded replies, direct-to-storage file attachments.
- **Agent inbox** — full ticket queue, internal notes (hidden from customers), status/priority/assignment management, canned responses.
- **Admin analytics** — SLA compliance charts, response-time breakdowns by priority and category, ticket volume over time.
- **Live updates** — new messages, status changes, and assignments appear in real time across open sessions: Supabase Realtime announces the change and the affected ticket or inbox list is refetched through the same RLS-scoped route handlers (no polling).
- **Server-rendered by default** — every page prefetches its data on the server and hydrates a TanStack Query cache, so there's no client-side fetch on first paint.
- **Row-level security throughout** — every table and storage bucket is RLS-enforced, tested directly against the API (not just hidden in the UI): a customer gets a 403 from staff-only routes and a plain 404 (never a permission leak) for another customer's ticket.

## Security

The demo logins above are public, so the app assumes every visitor may try to break it for the next one:

- **Demo accounts are locked at the database.** Their password, email and phone can't be changed and MFA can't be enrolled, so nobody can lock hirers out.
- **The demo resets nightly** (04:00 UTC, `pg_cron`): tickets, replies, canned responses, SLA targets and display names return to the seed.
- **Attachments are bound to their ticket.** An attachment record can only point at a file inside its own ticket's storage folder, enforced by a database check as well as the API.
- **Secrets stay server-side.** Only the publishable Supabase key reaches the browser; AI keys live in route handlers; the `embed` Edge Function only accepts calls carrying a shared secret kept in Supabase Vault (or a staff session).
- **Safe redirects, security headers.** Post-sign-in redirects must stay on this site; every response carries a Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a locked-down permissions policy.
- **AI usage is capped** per visitor (account + IP) and per account each day, so one visitor can't spend the shared allowance.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack, React Compiler) + React 19 + TypeScript
- [Supabase](https://supabase.com) (Postgres, Auth, Realtime, Storage, RLS)
- [TanStack Query](https://tanstack.com/query) over a thin `/api` layer with Zod-validated request bodies and session-persisted caching
- Tailwind CSS v4, [next-intl](https://next-intl.dev) (English content, i18n-ready), Recharts, Zod, react-hook-form

## Architecture

- `src/app` — routes: `/`, `/sign-in`, `/portal/*` (customer), `/inbox/*` (agent/admin), `/analytics` (admin), `/api/*` (REST-ish route handlers backing the query layer)
- `src/lib/api` — request-body Zod schemas, the `apiInstance` fetch client, and role-guards shared by every route handler
- `src/lib/query` — the TanStack Query client setup and browser-side persister
- `src/hooks/use-app-hooks` — query hooks per domain (tickets, inbox, analytics, AI); mutations live inline in the component that triggers them and refetch the affected queries on success
- `src/hooks/use-live-ticket.ts` — the Supabase Realtime subscription that refetches a ticket when it changes
- `src/lib/supabase` — server/browser Supabase clients
- `supabase/migrations` — the full schema: tables, RLS policies, triggers, the `admin_analytics()` RPC, and the reseedable demo fixture

See [`docs/HANDOFF.md`](docs/HANDOFF.md) for the decisions behind the build, the schema, the architecture and the known gaps. [`docs/AI-ASSIST.md`](docs/AI-ASSIST.md) explains the AI layer.

## Running locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

Tests: `npm test` (the API access suite expects the app on port 3100: `npx next dev -p 3100`).

Apply the migrations in `supabase/migrations/` to a Supabase project, deploy `supabase/functions/embed`, then open [http://localhost:3000](http://localhost:3000). Run `npm run backfill:knowledge` once to embed the seed data's canned responses and resolved tickets.

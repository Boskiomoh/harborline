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
- **Live updates** — new messages, status changes, and assignments appear in real time across open sessions via Supabase Realtime, patched directly into the client cache (no polling, no extra fetches).
- **Server-rendered by default** — every page prefetches its data on the server and hydrates a TanStack Query cache, so there's no client-side fetch on first paint.
- **Row-level security throughout** — every table and storage bucket is RLS-enforced, tested directly against the API (not just hidden in the UI): a customer gets a 403 from staff-only routes and a plain 404 (never a permission leak) for another customer's ticket.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript
- [Supabase](https://supabase.com) (Postgres, Auth, Realtime, Storage, RLS)
- [TanStack Query](https://tanstack.com/query) with a Zod-validated `/api` layer and session-persisted caching
- Tailwind CSS v4, [next-intl](https://next-intl.dev) (English content, i18n-ready), Recharts, Zod, react-hook-form

## Architecture

- `src/app` — routes: `/`, `/sign-in`, `/portal/*` (customer), `/inbox/*` (agent/admin), `/analytics` (admin), `/api/*` (REST-ish route handlers backing the query layer)
- `src/lib/api` — Zod schemas, typed fetch client, and role-guards shared by every route handler
- `src/lib/query` — the TanStack Query client setup, key factory, and browser-side persister
- `src/lib/queries` — query/mutation hooks per domain (tickets, inbox, analytics), including the cache-patch helpers shared between mutations and Realtime subscriptions
- `src/lib/supabase` — server/browser Supabase clients
- `supabase/migrations` — the full schema: tables, RLS policies, triggers, the `admin_analytics()` RPC, and the reseedable demo fixture

See [`docs/HANDOFF.md`](docs/HANDOFF.md) for a detailed build log, schema reference, and list of known gaps.

## Running locally

```bash
npm install
npm run dev
```

Requires a `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Apply the migrations in `supabase/migrations/` to a Supabase project, then open [http://localhost:3000](http://localhost:3000).

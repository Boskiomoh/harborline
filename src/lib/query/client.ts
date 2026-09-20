import { QueryClient } from "@tanstack/react-query";

/**
 * Shared defaults for both the server-side prefetch client and the browser client.
 *
 * - `staleTime` keeps a page from refetching on every mount/focus for half a minute; Realtime
 *   subscriptions (see use-live-ticket.ts, inbox-provider.tsx) keep the two liveliest queries
 *   (a ticket, the inbox list) fresh in between, so a longer staleTime doesn't mean stale UI.
 * - `gcTime` must outlive the persister's `maxAge` (see query-provider.tsx) or Query would evict
 *   a query from memory before the persisted copy is allowed to expire.
 * - `refetchOnWindowFocus` is off: the goal here is fewer background requests, and Realtime
 *   already carries anything focus-refetching would have caught.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getBrowserQueryClient, getSessionPersister, PERSIST_BUSTER, PERSIST_MAX_AGE } from "@/lib/query/browser-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getBrowserQueryClient();
  const persister = getSessionPersister();

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, buster: PERSIST_BUSTER, maxAge: PERSIST_MAX_AGE }}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  );
}

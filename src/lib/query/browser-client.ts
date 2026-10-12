import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { Persister } from "@tanstack/react-query-persist-client";
import { makeQueryClient } from "./client";

// Bump this if a query's shape changes incompatibly: old persisted caches with a different
// buster are discarded on restore instead of being handed to code that no longer expects them.
export const PERSIST_BUSTER = "1";
export const PERSIST_MAX_AGE = 12 * 60 * 60 * 1000;

const PERSIST_KEY = "harborline-query-cache";

// The persister batches writes (its own default throttle is 1s), so a write already in flight
// when sign-out clears the cache can still land afterwards. It would only ever write the *current*
// (now-empty) cache, never old ticket data, but suppressing writes for a beat after sign-out keeps
// the storage key from reappearing at all rather than reappearing empty. 1.5s comfortably covers
// the persister's throttle with margin, and normal persistence resumes on its own after that.
const SIGN_OUT_SUPPRESS_MS = 1500;

const noopPersister: Persister = {
  persistClient: () => {},
  restoreClient: () => undefined,
  removeClient: () => {},
};

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;
let browserPersister: Persister | undefined;
let suppressPersistUntil = 0;

/** Server: a fresh client per call (never shared across requests). Browser: one client for the tab. */
export function getBrowserQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

/** sessionStorage-backed persister: the cache survives reloads within the tab, gone once it closes. */
export function getSessionPersister(): Persister {
  if (typeof window === "undefined") return noopPersister;
  if (!browserPersister) {
    const inner = createAsyncStoragePersister({
      storage: window.sessionStorage,
      key: PERSIST_KEY,
    });
    browserPersister = {
      ...inner,
      persistClient: (client) => {
        if (Date.now() < suppressPersistUntil) return;
        return inner.persistClient(client);
      },
    };
  }
  return browserPersister;
}

/** Wipes the in-memory cache and the persisted copy. Call this on sign-out. */
export function clearBrowserQueryCache() {
  if (typeof window === "undefined") return;
  suppressPersistUntil = Date.now() + SIGN_OUT_SUPPRESS_MS;
  browserQueryClient?.clear();
  void getSessionPersister().removeClient();
}

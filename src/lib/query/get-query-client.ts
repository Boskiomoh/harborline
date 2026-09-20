import { cache } from "react";
import { makeQueryClient } from "./client";

/**
 * One QueryClient per server request (React's `cache()` scopes it to the current render), used
 * only for `prefetchQuery` + `dehydrate` in Server Components. Never imported by client code —
 * the browser gets its own client from `query-provider.tsx`.
 */
export const getQueryClient = cache(makeQueryClient);

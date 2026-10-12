import type { Database } from "@/lib/supabase/database.types";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3100";
export const DEMO_PASSWORD = "harborline-demo-2026";
export const DEMO = {
  customer: "customer@harborline.app",
  agent: "agent@harborline.app",
  admin: "admin@harborline.app",
} as const;

function env(name: string) {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is not set — these tests need .env.local`);
  return value;
}

/** A Supabase client signed in as a demo account, talking to the real project (RLS applies). */
export async function signedInClient(email: string) {
  const client = createClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw error;
  return client;
}

/**
 * Signs in exactly the way the app does (through @supabase/ssr) and returns the resulting
 * session cookies as a `Cookie` header, so API requests are authenticated like a real browser's.
 */
export async function sessionCookie(email: string) {
  const jar = new Map<string, string>();
  const client = createServerClient<Database>(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (cookies) =>
          cookies.forEach(({ name, value }) =>
            value ? jar.set(name, value) : jar.delete(name),
          ),
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

export async function assertServerUp() {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error(
      `No app server at ${BASE_URL}. Start it with \`npx next dev -p 3100\` (or set TEST_BASE_URL).`,
    );
  }
}

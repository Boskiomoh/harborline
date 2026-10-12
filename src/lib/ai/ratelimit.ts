/**
 * Daily caps on AI Assist calls, backed by Upstash Redis (docs/AI-ASSIST.md step G).
 *
 * Two fixed windows per UTC day, both `INCR`ed in one pipeline:
 * - per visitor: the viewer's account plus the client IP (`AI_DAILY_LIMIT`, default 30). The demo
 *   staff logins are shared by every hirer, so an account-only key would let one visitor spend
 *   the allowance for everyone.
 * - per account: a ceiling across all IPs (`AI_ACCOUNT_DAILY_LIMIT`, default 300), so rotating IPs
 *   can't drain the free Groq quota.
 *
 * - No `UPSTASH_REDIS_REST_URL`/`_TOKEN`: a no-op, every request is allowed.
 * - Upstash errors (unreachable, timed out, or the free database is full — it's created with
 *   eviction off, so writes start failing rather than silently dropping keys): fail open. The
 *   request is allowed and the error is logged once per server process, not once per request.
 *   Accepted because the providers are free tiers with no card attached, so the worst case is
 *   the provider's own limit, never a bill.
 *
 * Plain REST calls, no client library.
 */

const DEFAULT_VISITOR_LIMIT = 30;
const DEFAULT_ACCOUNT_LIMIT = 300;
const TIMEOUT_MS = 1500;
const TTL_SECONDS = String(26 * 60 * 60); // outlives its own day, whatever the clock skew

export type RateLimitResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; limit: number; resetAt: string };

let loggedFailure = false;

function envLimit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function nextUtcMidnight(now: Date) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
}

/** Only IP characters make it into a Redis key. */
function ipKey(clientIp: string | null | undefined) {
  const clean = (clientIp ?? "")
    .trim()
    .replace(/[^0-9a-fA-F:.]/g, "")
    .slice(0, 45);
  return clean || "unknown";
}

type PipelineReply = Array<{ result?: unknown; error?: string }>;

export async function checkAiRateLimit(
  userId: string,
  clientIp?: string | null,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true, remaining: null };

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const visitorLimit = envLimit("AI_DAILY_LIMIT", DEFAULT_VISITOR_LIMIT);
  const accountLimit = envLimit(
    "AI_ACCOUNT_DAILY_LIMIT",
    DEFAULT_ACCOUNT_LIMIT,
  );
  const visitorKey = `harborline:ai:${userId}:${ipKey(clientIp)}:${day}`;
  const accountKey = `harborline:ai:${userId}:${day}`;

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", visitorKey],
        ["EXPIRE", visitorKey, TTL_SECONDS, "NX"],
        ["INCR", accountKey],
        ["EXPIRE", accountKey, TTL_SECONDS, "NX"],
      ]),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Upstash responded ${response.status}`);

    const reply = (await response.json()) as PipelineReply;
    const visitor = reply[0];
    const account = reply[2];
    for (const incr of [visitor, account]) {
      if (incr?.error || typeof incr?.result !== "number")
        throw new Error(
          `Upstash INCR failed: ${incr?.error ?? "unexpected reply"}`,
        );
    }
    const visitorCount = visitor.result as number;
    const accountCount = account.result as number;

    const resetAt = nextUtcMidnight(now).toISOString();
    if (visitorCount > visitorLimit)
      return { allowed: false, limit: visitorLimit, resetAt };
    if (accountCount > accountLimit)
      return { allowed: false, limit: accountLimit, resetAt };
    return {
      allowed: true,
      remaining: Math.min(
        visitorLimit - visitorCount,
        accountLimit - accountCount,
      ),
    };
  } catch (error) {
    if (!loggedFailure) {
      loggedFailure = true;
      console.error(
        "[ai] rate limiter unavailable, failing open:",
        error instanceof Error ? error.message : error,
      );
    }
    return { allowed: true, remaining: null };
  }
}

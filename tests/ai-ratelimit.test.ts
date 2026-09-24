import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAiRateLimit } from "@/lib/ai/ratelimit";

// docs/AI-ASSIST.md step G. These talk to the real Upstash database from .env.local, with a
// throwaway user id per run so they never touch a real viewer's counter.
const saved = { ...process.env };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("checkAiRateLimit", () => {
  it("blocks once a viewer passes the daily cap", async () => {
    if (!saved.UPSTASH_REDIS_REST_URL) throw new Error("UPSTASH_REDIS_REST_URL is not set — this test needs .env.local");
    process.env.AI_DAILY_LIMIT = "2";
    const user = `test-${crypto.randomUUID()}`;

    expect(await checkAiRateLimit(user)).toEqual({ allowed: true, remaining: 1 });
    expect(await checkAiRateLimit(user)).toEqual({ allowed: true, remaining: 0 });

    const third = await checkAiRateLimit(user);
    expect(third.allowed).toBe(false);
    if (!third.allowed) {
      expect(third.limit).toBe(2);
      expect(Date.parse(third.resetAt)).toBeGreaterThan(Date.now());
    }
  });

  it("counts each visitor on a shared account separately, under an account-wide ceiling", async () => {
    if (!saved.UPSTASH_REDIS_REST_URL) throw new Error("UPSTASH_REDIS_REST_URL is not set — this test needs .env.local");
    process.env.AI_DAILY_LIMIT = "1";
    process.env.AI_ACCOUNT_DAILY_LIMIT = "2";
    const user = `test-${crypto.randomUUID()}`;

    expect((await checkAiRateLimit(user, "203.0.113.1")).allowed).toBe(true);
    expect((await checkAiRateLimit(user, "203.0.113.1")).allowed).toBe(false); // that visitor is done
    expect((await checkAiRateLimit(user, "203.0.113.2")).allowed).toBe(false); // account ceiling reached (3 > 2)
  });

  it("gives a second visitor their own allowance", async () => {
    if (!saved.UPSTASH_REDIS_REST_URL) throw new Error("UPSTASH_REDIS_REST_URL is not set — this test needs .env.local");
    process.env.AI_DAILY_LIMIT = "1";
    process.env.AI_ACCOUNT_DAILY_LIMIT = "10";
    const user = `test-${crypto.randomUUID()}`;

    expect((await checkAiRateLimit(user, "203.0.113.1")).allowed).toBe(true);
    expect((await checkAiRateLimit(user, "203.0.113.1")).allowed).toBe(false);
    expect((await checkAiRateLimit(user, "198.51.100.7")).allowed).toBe(true);
  });

  it("never blocks when Upstash isn't configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.AI_DAILY_LIMIT = "1";

    for (let i = 0; i < 5; i++) {
      expect(await checkAiRateLimit("anyone")).toEqual({ allowed: true, remaining: null });
    }
  });

  it("fails open when Upstash errors", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "http://127.0.0.1:9"; // nothing listens here
    process.env.UPSTASH_REDIS_REST_TOKEN = "not-a-real-token";
    process.env.AI_DAILY_LIMIT = "1";

    expect(await checkAiRateLimit("anyone")).toEqual({ allowed: true, remaining: null });
    expect(await checkAiRateLimit("anyone")).toEqual({ allowed: true, remaining: null });
  });

  it("fails open when Upstash rejects the credentials", async () => {
    process.env.UPSTASH_REDIS_REST_TOKEN = "wrong-token";
    process.env.AI_DAILY_LIMIT = "1";

    expect(await checkAiRateLimit(`test-${crypto.randomUUID()}`)).toEqual({ allowed: true, remaining: null });
  });
});

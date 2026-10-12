import { beforeAll, describe, expect, it } from "vitest";
import {
  assertServerUp,
  BASE_URL,
  DEMO,
  sessionCookie,
  signedInClient,
} from "./helpers";

/**
 * docs/AI-ASSIST.md step O, run against the real Supabase project and a running app server
 * (`npx next dev -p 3100`, or TEST_BASE_URL). None of these make a model call.
 */

const ROUTES = ["draft", "triage", "summary"] as const;
const TICKET = 1001; // Maya's (the demo customer's) own ticket, so RLS alone wouldn't stop her

describe("AI routes are staff-only", () => {
  let customerCookie = "";
  let agentCookie = "";

  beforeAll(async () => {
    await assertServerUp();
    [customerCookie, agentCookie] = await Promise.all([
      sessionCookie(DEMO.customer),
      sessionCookie(DEMO.agent),
    ]);
  });

  it.each(ROUTES)("signed out: POST /ai/%s is 401", async (route) => {
    const response = await fetch(
      `${BASE_URL}/api/tickets/${TICKET}/ai/${route}`,
      { method: "POST" },
    );
    expect(response.status).toBe(401);
  });

  it.each(ROUTES)(
    "customer: POST /ai/%s is 403, even on their own ticket",
    async (route) => {
      const response = await fetch(
        `${BASE_URL}/api/tickets/${TICKET}/ai/${route}`,
        { method: "POST", headers: { cookie: customerCookie } },
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden" });
    },
  );

  it("agent: passes the guard (triage on a non-new ticket answers without a model call)", async () => {
    const response = await fetch(
      `${BASE_URL}/api/tickets/${TICKET}/ai/triage`,
      { method: "POST", headers: { cookie: agentCookie } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "skipped",
      reason: "not_new",
    });
  });
});

describe("knowledge_chunks access", () => {
  it("is unreadable as the customer demo account", async () => {
    const customer = await signedInClient(DEMO.customer);
    const { data, error } = await customer
      .from("knowledge_chunks")
      .select("id, content")
      .limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const zero = JSON.stringify(Array.from({ length: 384 }, () => 0.05));
    const rpc = await customer.rpc("match_knowledge_chunks", {
      query_embedding: zero,
      match_count: 5,
    });
    expect(rpc.data ?? []).toEqual([]);
  });

  it("rejects writes from staff too (only the service role writes)", async () => {
    const agent = await signedInClient(DEMO.agent);
    const zero = JSON.stringify(Array.from({ length: 384 }, () => 0.05));
    const { error } = await agent
      .from("knowledge_chunks")
      .insert({
        source_type: "canned_response",
        source_id: 999_999,
        content: "probe",
        embedding: zero,
      });
    expect(error).not.toBeNull();
  });

  it("is readable by staff and never contains an internal note", async () => {
    const agent = await signedInClient(DEMO.agent);
    const { data: chunks, error } = await agent
      .from("knowledge_chunks")
      .select("source_type, source_id, content");
    expect(error).toBeNull();
    expect(chunks!.length).toBeGreaterThan(0);

    const messageIds = chunks!
      .filter((c) => c.source_type === "resolved_ticket")
      .map((c) => c.source_id);
    const { data: notes, error: notesError } = await agent
      .from("ticket_messages")
      .select("id, body")
      .eq("is_internal_note", true);
    expect(notesError).toBeNull();
    expect(notes!.length).toBeGreaterThan(0); // the seed has internal notes, so this check has teeth

    const noteIds = new Set(notes!.map((n) => n.id));
    expect(messageIds.filter((id) => noteIds.has(id))).toEqual([]);
    for (const note of notes!) {
      expect(chunks!.some((c) => c.content.includes(note.body))).toBe(false);
    }
  });
});

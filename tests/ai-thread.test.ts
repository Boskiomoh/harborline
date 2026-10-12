import {
  customerMessages,
  draftThread,
  formatThread,
  summaryThread,
} from "@/lib/ai/thread";
import type { People, TicketMessage } from "@/lib/tickets";
import { describe, expect, it } from "vitest";

const CUSTOMER = "00000000-0000-4000-8000-000000000001";
const AGENT = "00000000-0000-4000-8000-000000000002";

const people: People = {
  [CUSTOMER]: { id: CUSTOMER, fullName: "Maya Okafor", role: "customer" },
  [AGENT]: { id: AGENT, fullName: "Tomás Reyes", role: "agent" },
};

function message(
  id: number,
  author: string,
  body: string,
  internal = false,
): TicketMessage {
  return {
    id,
    ticket_id: 1001,
    author_id: author,
    body,
    is_internal_note: internal,
    created_at: `2026-09-20T10:0${id}:00+00:00`,
  };
}

const thread = [
  message(1, CUSTOMER, "My parcel never arrived."),
  message(2, AGENT, "I've opened a courier trace."),
  message(3, AGENT, "Reship at no cost if no proof of delivery by noon.", true),
  message(4, CUSTOMER, "Thanks, any news?"),
];

describe("which messages each AI feature may read", () => {
  it("drafts never see internal notes", () => {
    const result = draftThread(thread);
    expect(result.map((m) => m.id)).toEqual([1, 2, 4]);
    expect(result.some((m) => m.is_internal_note)).toBe(false);
  });

  it("summaries include internal notes for staff viewers", () => {
    expect(summaryThread(thread, "agent").map((m) => m.id)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(summaryThread(thread, "admin").some((m) => m.is_internal_note)).toBe(
      true,
    );
  });

  it("summaries drop internal notes for a customer viewer", () => {
    const result = summaryThread(thread, "customer");
    expect(result.map((m) => m.id)).toEqual([1, 2, 4]);
  });

  it("customerMessages keeps only public customer-authored messages", () => {
    expect(customerMessages(thread, people).map((m) => m.id)).toEqual([1, 4]);
  });

  it("formatThread labels internal notes as staff-only", () => {
    const text = formatThread(thread, people);
    expect(text).toContain("[Customer Maya Okafor");
    expect(text).toContain("[Internal note (staff only) by Tomás Reyes");
  });
});

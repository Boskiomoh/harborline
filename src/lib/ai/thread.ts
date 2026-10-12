/**
 * Which messages an AI feature may read, and how they're rendered into a prompt. Pure functions,
 * no I/O — the access rules live here so they can be tested directly (tests/ai-thread.test.ts).
 */
import { isStaff, type Role } from "@/lib/roles";
import type { People, TicketMessage } from "@/lib/tickets";

/** Drafts go to the customer, so they are only ever built from the public thread. */
export function draftThread(messages: TicketMessage[]): TicketMessage[] {
  return messages.filter((m) => !m.is_internal_note);
}

/**
 * Summaries are for the agent picking a ticket up, so staff get internal notes too; anyone else
 * gets the public thread only. Every caller today is staff (the route is staff-only), but the
 * rule is kept explicit here rather than assumed from the route guard.
 */
export function summaryThread(
  messages: TicketMessage[],
  viewerRole: Role,
): TicketMessage[] {
  return isStaff(viewerRole)
    ? messages
    : messages.filter((m) => !m.is_internal_note);
}

/** Customer-authored messages, newest last — the part of a thread that says what's wrong. */
export function customerMessages(
  messages: TicketMessage[],
  people: People,
): TicketMessage[] {
  return messages.filter(
    (m) =>
      !m.is_internal_note &&
      m.author_id &&
      people[m.author_id]?.role === "customer",
  );
}

function speaker(message: TicketMessage, people: People) {
  const person = message.author_id ? people[message.author_id] : undefined;
  const role =
    person?.role === "customer" ? "Customer" : person ? "Agent" : "Unknown";
  const label = message.is_internal_note
    ? `Internal note (staff only) by ${person?.fullName ?? "staff"}`
    : `${role}${person ? ` ${person.fullName}` : ""}`;
  return `[${label} · ${message.created_at.slice(0, 16).replace("T", " ")} UTC]`;
}

/** Renders messages as a plain transcript for a prompt. */
export function formatThread(
  messages: TicketMessage[],
  people: People,
): string {
  return messages
    .map((m) => `${speaker(m, people)}\n${m.body.trim()}`)
    .join("\n\n");
}

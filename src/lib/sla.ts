import type { Enums } from "@/lib/supabase/database.types";

export type TicketStatus = Enums<"ticket_status">;

export type SlaInput = {
  createdAt: string | number | Date;
  targetMinutes: number;
  firstResponseAt?: string | number | Date | null;
  status: TicketStatus;
};

export type SlaState =
  | { kind: "running"; remainingMs: number; progress: number; targetMs: number }
  | { kind: "overdue"; overdueMs: number; targetMs: number }
  | { kind: "met"; responseMs: number; targetMs: number }
  | { kind: "missed"; responseMs: number; targetMs: number }
  | { kind: "none" };

const toMs = (value: string | number | Date) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

export function computeSla({ createdAt, targetMinutes, firstResponseAt, status }: SlaInput, now: number): SlaState {
  const created = toMs(createdAt);
  const targetMs = targetMinutes * 60_000;

  if (firstResponseAt) {
    const responseMs = toMs(firstResponseAt) - created;
    return responseMs <= targetMs ? { kind: "met", responseMs, targetMs } : { kind: "missed", responseMs, targetMs };
  }

  // Resolved without a public reply (e.g. closed as a duplicate): no clock to show.
  if (status === "resolved") return { kind: "none" };

  const elapsed = now - created;
  if (elapsed > targetMs) return { kind: "overdue", overdueMs: elapsed - targetMs, targetMs };
  return { kind: "running", remainingMs: targetMs - elapsed, progress: Math.max(0, elapsed / targetMs), targetMs };
}

/** Share of the response window still left: 1 when the ticket opens, 0 at (and after) the deadline. */
export function remainingFraction(state: SlaState) {
  if (state.kind === "running") return Math.min(1, Math.max(0, state.remainingMs / state.targetMs));
  if (state.kind === "overdue") return 0;
  return null;
}

export type DurationParts = {
  key: "seconds" | "minutesSeconds" | "minutes" | "hours" | "hoursMinutes" | "days" | "daysHours";
  values: Record<string, number>;
};

export function durationParts(ms: number): DurationParts {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3_600);
  const m = Math.floor((total % 3_600) / 60);
  const s = total % 60;

  if (d > 0) return h > 0 ? { key: "daysHours", values: { d, h } } : { key: "days", values: { d } };
  if (h > 0) return m > 0 ? { key: "hoursMinutes", values: { h, m } } : { key: "hours", values: { h } };
  if (m >= 10) return { key: "minutes", values: { m } };
  if (m > 0) return { key: "minutesSeconds", values: { m, s } };
  return { key: "seconds", values: { s } };
}

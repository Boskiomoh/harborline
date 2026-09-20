import type { TicketStatus } from "@/lib/sla";

/** Left-edge colour bar used on ticket rows, so status reads at a glance alongside the pill. */
export function statusStripe(status: TicketStatus) {
  switch (status) {
    case "new":
      return "bg-ink-faint";
    case "in_progress":
      return "bg-accent/55";
    case "waiting_on_customer":
      return "bg-warm";
    case "resolved":
      return "bg-accent";
  }
}

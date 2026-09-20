import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { Enums } from "@/lib/supabase/database.types";

type Priority = Enums<"ticket_priority">;

// Four signal bars: the number filled is the priority level, the colour follows the same
// green-to-red scale as the SLA timer. The text label keeps it readable without colour.
const LEVELS: Record<Priority, { filled: number; color: string }> = {
  low: { filled: 1, color: "var(--success)" },
  normal: { filled: 2, color: "var(--warning)" },
  high: { filled: 3, color: "var(--warm)" },
  urgent: { filled: 4, color: "var(--danger)" },
};

export function PriorityLabel({ priority, className }: { priority: Priority; className?: string }) {
  const t = useTranslations("priority");
  const { filled, color } = LEVELS[priority];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[0.8125rem] whitespace-nowrap",
        priority === "urgent" ? "font-semibold text-danger" : priority === "high" ? "font-medium text-ink" : "text-ink-soft",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 15 12" className="h-3 w-[0.9375rem] shrink-0">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 4} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={i < filled ? color : "var(--border)"} />
        ))}
      </svg>
      {t(priority)}
    </span>
  );
}

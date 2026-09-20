import { useTranslations } from "next-intl";
import { CheckCircle, CircleDashed, CircleHalf, Hourglass } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { TicketStatus } from "@/lib/sla";

const styles: Record<TicketStatus, string> = {
  new: "border-border bg-surface-alt text-ink",
  in_progress: "border-accent/20 bg-accent-soft text-accent-ink",
  waiting_on_customer: "border-warm/25 bg-warm-soft text-warm-ink",
  resolved: "border-accent bg-accent text-white",
};

const icons = {
  new: CircleDashed,
  in_progress: CircleHalf,
  waiting_on_customer: Hourglass,
  resolved: CheckCircle,
} as const;

export function StatusPill({
  status,
  audience = "staff",
  size = "md",
  className,
}: {
  status: TicketStatus;
  audience?: "customer" | "staff";
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("status");
  const Icon = icons[status];
  const label = status === "waiting_on_customer" && audience === "customer" ? t("waiting_on_you") : t(status);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[0.8125rem]",
        styles[status],
        className,
      )}
    >
      <Icon aria-hidden weight={status === "resolved" ? "fill" : "bold"} className={size === "sm" ? "size-3.5" : "size-4"} />
      {label}
    </span>
  );
}

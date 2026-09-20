import { CheckCircle, Hourglass, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

const tones = {
  success: { box: "border-accent/25 bg-accent-soft text-accent-ink", Icon: CheckCircle },
  waiting: { box: "border-warm/30 bg-warm-soft text-warm-ink", Icon: Hourglass },
  error: { box: "border-danger/25 bg-danger/5 text-danger", Icon: WarningCircle },
} as const;

export function Banner({ tone, children, className }: { tone: keyof typeof tones; children: React.ReactNode; className?: string }) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-[8px] border px-4 py-3 text-sm leading-relaxed", box, className)}>
      <Icon aria-hidden weight="fill" className="mt-0.5 size-[1.125rem] shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

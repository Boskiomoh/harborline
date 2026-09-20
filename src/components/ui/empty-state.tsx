import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[8px] border border-dashed border-border px-6 py-12 text-center sm:px-10", className)}>
      {icon && <div className="mx-auto grid size-14 place-items-center rounded-full bg-surface-alt text-ink-soft">{icon}</div>}
      <h2 className={cn("font-display text-xl font-semibold tracking-[-0.02em] text-ink", icon ? "mt-4" : undefined)}>{title}</h2>
      <p className="mx-auto mt-2 max-w-[44ch] leading-relaxed text-ink-soft">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

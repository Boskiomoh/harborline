import { cn } from "@/lib/cn";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({
  name,
  tone = "customer",
  size = "md",
  className,
}: {
  name: string;
  tone?: "customer" | "staff";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold tracking-tight",
        size === "sm" && "size-7 text-[0.6875rem]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-11 text-sm",
        tone === "staff" ? "bg-accent-soft text-accent-ink" : "bg-surface-alt text-ink-soft",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium select-none " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-soft hover:bg-accent-ink",
  secondary: "border border-border bg-surface text-ink hover:border-ink-faint hover:bg-surface-alt/50",
  ghost: "text-ink-soft hover:bg-surface-alt hover:text-ink",
  // Destructive confirmations only (white on --danger is 6.1:1).
  danger: "bg-danger text-white shadow-soft hover:bg-danger/90",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

import { cn } from "@/lib/cn";
import { LogoMark } from "./logo-mark";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.4em] font-display text-[1.375rem] leading-none font-bold tracking-[-0.035em] text-accent-ink [font-variation-settings:'wdth'_82]",
        className,
      )}
    >
      <LogoMark className="size-[1.2em]" />
      Harborline
    </span>
  );
}

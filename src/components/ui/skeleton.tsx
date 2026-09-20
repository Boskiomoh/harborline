import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded-[8px] bg-surface-alt motion-safe:animate-pulse", className)} />;
}

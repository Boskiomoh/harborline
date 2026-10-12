import { cn } from "@/lib/cn";
import { FC } from "react";

const Skeleton: FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden
    className={cn(
      "rounded-[8px] bg-surface-alt motion-safe:animate-pulse",
      className,
    )}
  />
);

export { Skeleton };

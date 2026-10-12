import { cn } from "@/lib/cn";
import { FC } from "react";
import LogoMark from "./logo-mark";

const Wordmark: FC<{ className?: string }> = ({ className }) => (
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

export default Wordmark;

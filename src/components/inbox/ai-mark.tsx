import { cn } from "@/lib/cn";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { FC } from "react";

// The one mark every AI Assist surface carries, so agents learn to spot machine-written text.
const AiMark: FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden
    className={cn(
      "grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink",
      className,
    )}
  >
    <Sparkle weight="fill" className="size-4" />
  </span>
);

export default AiMark;

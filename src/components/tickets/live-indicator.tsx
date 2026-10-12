"use client";

import type { LiveConnection } from "@/hooks/use-live-ticket";
import { cn } from "@/lib/cn";
import { useTranslations } from "next-intl";
import { FC } from "react";

interface LiveIndicatorProps {
  state: LiveConnection;
  className?: string;
}

const LiveIndicator: FC<LiveIndicatorProps> = ({ state, className }) => {
  const t = useTranslations("thread");

  // Derived
  const label =
    state === "live"
      ? t("live")
      : state === "offline"
        ? t("offline")
        : t("connecting");

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 text-xs text-ink-soft",
        className,
      )}
    >
      <span className="relative flex size-2">
        {state === "live" && (
          <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping" />
        )}
        <span
          className={cn(
            "relative size-2 rounded-full",
            state === "live"
              ? "bg-accent"
              : state === "offline"
                ? "bg-warm"
                : "bg-ink-faint",
          )}
        />
      </span>
      {label}
    </span>
  );
};

export default LiveIndicator;

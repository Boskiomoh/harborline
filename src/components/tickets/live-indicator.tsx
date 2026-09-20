"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { LiveConnection } from "./use-live-ticket";

export function LiveIndicator({ state, className }: { state: LiveConnection; className?: string }) {
  const t = useTranslations("thread");
  const label = state === "live" ? t("live") : state === "offline" ? t("offline") : t("connecting");

  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-xs text-ink-soft", className)}>
      <span className="relative flex size-2">
        {state === "live" && <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping" />}
        <span className={cn("relative size-2 rounded-full", state === "live" ? "bg-accent" : state === "offline" ? "bg-warm" : "bg-ink-faint")} />
      </span>
      {label}
    </span>
  );
}

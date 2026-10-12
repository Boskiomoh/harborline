"use client";

import useNow from "@/hooks/use-now";
import { cn } from "@/lib/cn";
import {
  computeSla,
  durationParts,
  remainingFraction,
  type TicketStatus,
} from "@/lib/sla";
import { CheckCircle, Timer, Warning } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";

interface SlaBadgeProps {
  targetMinutes: number;
  status: TicketStatus;
  createdAt?: string;
  firstResponseAt?: string | null;
  // For static previews: the clock started this many minutes before the component mounted.
  startedMinutesAgo?: number;
  // Request time from the server, used until hydration so the first render matches.
  serverNow?: number;
  // Only show the badge while the clock is running or overdue (used in dense lists).
  hideSettled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

// Time left drives the colour: green with the full window, through amber and coral, to red at zero.
const stops = [
  { at: 0, color: "var(--danger)" },
  { at: 0.2, color: "var(--warm)" },
  { at: 0.5, color: "var(--warning)" },
  { at: 1, color: "var(--success)" },
] as const;

const colorForRemaining = (fraction: number) => {
  const f = Math.min(1, Math.max(0, fraction));

  for (let i = 1; i < stops.length; i++) {
    const lo = stops[i - 1];
    const hi = stops[i];

    if (f <= hi.at) {
      const share = Math.round(((f - lo.at) / (hi.at - lo.at)) * 100);

      return `color-mix(in oklab, ${hi.color} ${share}%, ${lo.color})`;
    }
  }

  return stops[stops.length - 1].color;
};

const SlaBadge: FC<SlaBadgeProps> = ({
  targetMinutes,
  status,
  createdAt,
  firstResponseAt,
  startedMinutesAgo,
  serverNow,
  hideSettled,
  size = "md",
  className,
}) => {
  const t = useTranslations("sla");
  const td = useTranslations("duration");
  const now = useNow() ?? serverNow ?? null;

  // State
  const [mountedAt] = useState(() => Date.now());

  // Handlers
  const format = (ms: number) => {
    const { key, values } = durationParts(ms);

    return td(key, values);
  };

  const boxClass = cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono font-medium whitespace-nowrap tabular-nums",
    size === "sm" ? "h-6 px-2 text-[0.6875rem]" : "h-7 px-2.5 text-xs",
    className,
  );

  if (now === null) {
    return (
      <span
        className={cn(boxClass, "border-border bg-surface-alt text-ink-soft")}
      >
        <span className="sr-only">{t("loading")}</span>
        <span aria-hidden className="inline-block w-20" />
      </span>
    );
  }

  const created =
    startedMinutesAgo !== undefined
      ? mountedAt - startedMinutesAgo * 60_000
      : (createdAt ?? now);
  const state = computeSla(
    { createdAt: created, targetMinutes, firstResponseAt, status },
    now,
  );

  if (state.kind === "none") return null;
  if (hideSettled && (state.kind === "met" || state.kind === "missed")) {
    return null;
  }

  const target = format(state.targetMs);
  const fraction = remainingFraction(state);
  const color =
    state.kind === "met"
      ? "var(--success)"
      : state.kind === "missed"
        ? "var(--warm)"
        : colorForRemaining(fraction ?? 0);

  let label: string;
  let aria: string;
  let Icon = Timer;

  switch (state.kind) {
    case "running": {
      const time = format(state.remainingMs);
      label = t("remaining", { time });
      aria = t("ariaRunning", { time, target });
      break;
    }
    case "overdue": {
      const time = format(state.overdueMs);
      label = t("overdue", { time });
      aria = t("ariaOverdue", { time, target });
      Icon = Warning;
      break;
    }
    case "met":
    case "missed": {
      const time = format(state.responseMs);
      label = t(state.kind, { time });
      aria = t(state.kind === "met" ? "ariaMet" : "ariaMissed", {
        time,
        target,
      });
      Icon = state.kind === "met" ? CheckCircle : Warning;
      break;
    }
  }

  const tint = (amount: number) =>
    `color-mix(in oklab, ${color} ${amount}%, var(--surface))`;

  // The badge itself is the gauge: the filled part of the pill is the time still left,
  // draining to an empty pill at the deadline.
  return (
    <span
      className={cn(boxClass, "relative overflow-hidden")}
      title={aria}
      style={{
        // Text stays dark enough for AA over both the filled and the empty part.
        color: `color-mix(in oklab, ${color} 40%, var(--ink))`,
        backgroundColor: fraction === null ? tint(14) : tint(4),
        borderColor: tint(45),
      }}
    >
      {fraction !== null && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 transition-[width,background-color] duration-1000 ease-linear motion-reduce:transition-none"
          style={{ width: `${fraction * 100}%`, backgroundColor: tint(40) }}
        />
      )}
      <span className="relative flex items-center gap-1.5">
        <Icon
          aria-hidden
          weight={state.kind === "running" ? "bold" : "fill"}
          className={size === "sm" ? "size-3.5" : "size-4"}
          style={{ color }}
        />
        <span aria-hidden>{label}</span>
      </span>
      <span className="sr-only">{aria}</span>
    </span>
  );
};

export { SlaBadge };

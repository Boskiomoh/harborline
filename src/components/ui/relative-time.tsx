"use client";

import { useFormatter } from "next-intl";
import { useNow } from "./use-now";

/**
 * "5 minutes ago", kept fresh on the client. Renders from `serverNow` until hydration
 * finishes, so server and client markup match.
 */
export function RelativeTime({ date, serverNow, className }: { date: string; serverNow: number; className?: string }) {
  const format = useFormatter();
  const now = useNow() ?? serverNow;
  const value = new Date(date);

  return (
    <time dateTime={date} className={className}>
      {format.relativeTime(value, Math.max(now, value.getTime()))}
    </time>
  );
}

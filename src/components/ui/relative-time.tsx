"use client";

import useNow from "@/hooks/use-now";
import { useFormatter } from "next-intl";
import { FC } from "react";

interface RelativeTimeProps {
  date: string;
  serverNow: number;
  className?: string;
}

// Renders from `serverNow` until hydration finishes, so server and client markup match.
const RelativeTime: FC<RelativeTimeProps> = ({
  date,
  serverNow,
  className,
}) => {
  const format = useFormatter();
  const now = useNow() ?? serverNow;
  const value = new Date(date);

  return (
    <time dateTime={date} className={className}>
      {format.relativeTime(value, Math.max(now, value.getTime()))}
    </time>
  );
};

export { RelativeTime };

import { cn } from "@/lib/cn";
import { FC } from "react";

interface LogoMarkProps {
  className?: string;
  title?: string;
}

// Two mooring posts form an H, tied together by a coral line. Geometry is
// shared with src/app/icon.svg and src/app/apple-icon.tsx (64-unit grid).
const LogoMark: FC<LogoMarkProps> = ({ className, title }) => (
  <svg
    viewBox="0 0 64 64"
    className={cn("shrink-0", className)}
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <rect width="64" height="64" rx="14" fill="#0E5C4C" />
    <rect x="17" y="13" width="8" height="38" rx="4" fill="#FAF5EC" />
    <rect x="39" y="13" width="8" height="38" rx="4" fill="#FAF5EC" />
    <rect x="11" y="30" width="42" height="7" rx="3.5" fill="#D4602A" />
  </svg>
);

export default LogoMark;

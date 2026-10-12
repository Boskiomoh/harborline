"use client";

import { cn } from "@/lib/cn";
import { ChartBar, Plus, Tray } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FC } from "react";

export interface NavItem {
  href: string;
  label: string;
  icon: "tickets" | "new" | "inbox" | "analytics";
  // Regex sources matched against the pathname to decide the active item.
  matches: string[];
}

const icons = {
  tickets: Tray,
  new: Plus,
  inbox: Tray,
  analytics: ChartBar,
} as const;

interface AppNavProps {
  items: NavItem[];
  label: string;
  className?: string;
  onNavigate?: () => void;
  // Icon-only rail: labels become screen-reader text plus a hover tooltip.
  collapsed?: boolean;
}

const AppNav: FC<AppNavProps> = ({
  items,
  label,
  className,
  onNavigate,
  collapsed = false,
}) => {
  // Router
  const pathname = usePathname();

  return (
    <nav aria-label={label} className={className}>
      <ul className="grid gap-0.5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = item.matches.some((source) =>
            new RegExp(source).test(pathname),
          );

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex h-10 items-center rounded-full text-[0.9375rem] transition-colors",
                  collapsed ? "mx-auto w-10 justify-center" : "gap-3 px-3.5",
                  active
                    ? "bg-accent-soft font-semibold text-accent-ink"
                    : "text-ink-soft hover:bg-surface-alt hover:text-ink",
                )}
              >
                <Icon
                  aria-hidden
                  weight={active ? "fill" : "regular"}
                  className="size-5 shrink-0"
                />
                <span className={collapsed ? "sr-only" : "truncate"}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default AppNav;

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, List, Plus, Tray, X } from "@phosphor-icons/react/dist/ssr";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/cn";

export type NavItem = {
  href: string;
  label: string;
  icon: "tickets" | "new" | "inbox" | "analytics";
  /** Regex sources matched against the pathname to decide the active item. */
  matches: string[];
};

const icons = { tickets: Tray, new: Plus, inbox: Tray, analytics: ChartBar } as const;

export function AppNav({
  items,
  label,
  className,
  onNavigate,
  collapsed = false,
}: {
  items: NavItem[];
  label: string;
  className?: string;
  onNavigate?: () => void;
  /** Icon-only rail: labels become screen-reader text plus a hover tooltip. */
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => item.matches.some((source) => new RegExp(source).test(pathname));

  return (
    <nav aria-label={label} className={className}>
      <ul className="grid gap-0.5">
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = isActive(item);
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
                  active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-soft hover:bg-surface-alt hover:text-ink",
                )}
              >
                <Icon aria-hidden weight={active ? "fill" : "regular"} className="size-5 shrink-0" />
                <span className={collapsed ? "sr-only" : "truncate"}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav({
  items,
  label,
  openLabel,
  closeLabel,
  homeHref,
  homeLabel,
  children,
}: {
  items: NavItem[];
  label: string;
  openLabel: string;
  closeLabel: string;
  homeHref: string;
  homeLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-bg lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href={homeHref} aria-label={homeLabel} className="rounded-[8px] px-1 py-1">
          <Wordmark className="text-xl" />
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? closeLabel : openLabel}
          onClick={() => setOpen((value) => !value)}
          className="grid size-10 place-items-center rounded-full text-ink hover:bg-surface-alt"
        >
          {open ? <X aria-hidden weight="bold" className="size-5" /> : <List aria-hidden weight="bold" className="size-5" />}
        </button>
      </div>
      <div id="mobile-nav" hidden={!open} className="border-t border-border px-3 pt-3 pb-4">
        <AppNav items={items} label={label} onNavigate={() => setOpen(false)} />
        <div className="mt-3 border-t border-border pt-3">{children}</div>
      </div>
    </div>
  );
}

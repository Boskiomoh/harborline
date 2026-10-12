"use client";

import Wordmark from "@/components/brand/wordmark";
import { List, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { FC, useEffect, useState, type ReactNode } from "react";
import AppNav, { type NavItem } from "./app-nav";

interface MobileNavProps {
  items: NavItem[];
  label: string;
  openLabel: string;
  closeLabel: string;
  homeHref: string;
  homeLabel: string;
  children: ReactNode;
}

const MobileNav: FC<MobileNavProps> = ({
  items,
  label,
  openLabel,
  closeLabel,
  homeHref,
  homeLabel,
  children,
}) => {
  // State
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-bg lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link
          href={homeHref}
          aria-label={homeLabel}
          className="rounded-[8px] px-1 py-1"
        >
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
          {open ? (
            <X aria-hidden weight="bold" className="size-5" />
          ) : (
            <List aria-hidden weight="bold" className="size-5" />
          )}
        </button>
      </div>
      <div
        id="mobile-nav"
        hidden={!open}
        className="border-t border-border px-3 pt-3 pb-4"
      >
        <AppNav items={items} label={label} onNavigate={() => setOpen(false)} />
        <div className="mt-3 border-t border-border pt-3">{children}</div>
      </div>
    </div>
  );
};

export default MobileNav;

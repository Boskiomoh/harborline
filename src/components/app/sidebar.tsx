"use client";

import SignOutButton from "@/components/app/sign-out-button";
import LogoMark from "@/components/brand/logo-mark";
import Wordmark from "@/components/brand/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import {
  CaretDoubleLeft,
  CaretDoubleRight,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { FC, useState } from "react";
import AppNav, { type NavItem } from "./app-nav";

interface SidebarProps {
  items: NavItem[];
  homeHref: string;
  fullName: string;
  roleLabel: string;
  tone: "customer" | "staff";
  initialCollapsed: boolean;
  labels: {
    nav: string;
    home: string;
    collapse: string;
    expand: string;
    signOut: string;
  };
}

const Sidebar: FC<SidebarProps> = ({
  items,
  homeHref,
  fullName,
  roleLabel,
  tone,
  initialCollapsed,
  labels,
}) => {
  // State
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Derived
  const toggleLabel = collapsed ? labels.expand : labels.collapse;
  const ToggleIcon = collapsed ? CaretDoubleRight : CaretDoubleLeft;

  // Handlers
  const handleToggle = () => {
    const next = !collapsed;

    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-border pt-5 pb-3 transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
        collapsed ? "w-[4.5rem] px-2" : "w-60 px-3",
      )}
    >
      <div
        className={cn(
          "flex items-center",
          collapsed ? "flex-col gap-3" : "justify-between gap-2 pl-1",
        )}
      >
        <Link
          href={homeHref}
          aria-label={labels.home}
          className="rounded-[8px] p-1"
        >
          {collapsed ? <LogoMark className="size-8" /> : <Wordmark />}
        </Link>
        <button
          type="button"
          onClick={handleToggle}
          aria-controls="app-sidebar"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
        >
          <ToggleIcon aria-hidden weight="bold" className="size-4" />
        </button>
      </div>

      <AppNav
        items={items}
        label={labels.nav}
        collapsed={collapsed}
        className="mt-8"
      />

      <div className="mt-auto border-t border-border pt-3">
        <div
          className={cn(
            "flex items-center rounded-[8px] py-2",
            collapsed ? "flex-col gap-2" : "gap-3 px-2",
          )}
        >
          <span title={collapsed ? `${fullName}, ${roleLabel}` : undefined}>
            <Avatar name={fullName} tone={tone} />
          </span>
          {collapsed ? (
            <span className="sr-only">
              {fullName}, {roleLabel}
            </span>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {fullName}
              </p>
              <p className="truncate text-xs text-ink-soft">{roleLabel}</p>
            </div>
          )}
          <SignOutButton label={labels.signOut} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

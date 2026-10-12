import SignOutButton from "@/components/app/sign-out-button";
import { Avatar } from "@/components/ui/avatar";
import { SkipLink } from "@/components/ui/skip-link";
import type { Viewer } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import type { NavItem } from "./app-nav";
import MobileNav from "./mobile-nav";
import Sidebar from "./sidebar";

interface AppShellProps {
  viewer: Viewer;
  children: ReactNode;
}

const AppShell = async ({ viewer, children }: AppShellProps) => {
  const [t, cookieStore] = await Promise.all([getTranslations(), cookies()]);

  // Derived
  const collapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const homeHref = homeForRole(viewer.role);
  const tone = viewer.role === "customer" ? "customer" : "staff";
  const roleLabel = t(`roles.${viewer.role}`);

  const items: NavItem[] =
    viewer.role === "customer"
      ? [
          {
            href: "/portal",
            label: t("app.nav.myTickets"),
            icon: "tickets",
            matches: ["^/portal$", "^/portal/tickets"],
          },
          {
            href: "/portal/new",
            label: t("app.nav.newTicket"),
            icon: "new",
            matches: ["^/portal/new"],
          },
        ]
      : [
          {
            href: "/inbox",
            label: t("app.nav.inbox"),
            icon: "inbox",
            matches: ["^/inbox"],
          },
          ...(viewer.role === "admin"
            ? [
                {
                  href: "/analytics",
                  label: t("app.nav.analytics"),
                  icon: "analytics" as const,
                  matches: ["^/analytics"],
                },
              ]
            : []),
        ];

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[auto_minmax(0,1fr)]">
      <SkipLink label={t("nav.skipToContent")} />

      <Sidebar
        items={items}
        homeHref={homeHref}
        fullName={viewer.fullName}
        roleLabel={roleLabel}
        tone={tone}
        initialCollapsed={collapsed}
        labels={{
          nav: t("app.nav.label"),
          home: t("brand.home"),
          collapse: t("app.nav.collapse"),
          expand: t("app.nav.expand"),
          signOut: t("nav.signOut"),
        }}
      />

      <MobileNav
        items={items}
        label={t("app.nav.label")}
        openLabel={t("app.nav.openMenu")}
        closeLabel={t("app.nav.closeMenu")}
        homeHref={homeHref}
        homeLabel={t("brand.home")}
      >
        <div className="flex items-center gap-3 rounded-[8px] px-2 py-2">
          <Avatar name={viewer.fullName} tone={tone} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">
              {viewer.fullName}
            </p>
            <p className="truncate text-xs text-ink-soft">{roleLabel}</p>
          </div>
          <SignOutButton label={t("nav.signOut")} />
        </div>
      </MobileNav>

      {/* relative: keeps absolutely positioned descendants from extending the document height */}
      <main id="main" className="relative min-w-0">
        {children}
      </main>
    </div>
  );
};

export default AppShell;

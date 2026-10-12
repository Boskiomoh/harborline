"use client";

import { statusStripe } from "@/components/tickets/status-stripe";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { useMyTickets } from "@/hooks/use-app-hooks/use-tickets";
import { cn } from "@/lib/cn";
import type { MyTicketRow } from "@/lib/tickets";
import { Plus, Tray } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FC } from "react";

interface PortalTicketListProps {
  serverNow: number;
}

const PortalTicketList: FC<PortalTicketListProps> = ({ serverNow }) => {
  const t = useTranslations();

  // Router
  const searchParams = useSearchParams();
  const view = searchParams.get("tab") === "resolved" ? "resolved" : "open";

  // Queries
  const { data: myTicketsData } = useMyTickets();

  // Derived
  const tickets: MyTicketRow[] = myTicketsData ?? [];
  // Tickets that need the customer float to the top of the open list.
  const open = tickets
    .filter((ticket) => ticket.status !== "resolved")
    .sort(
      (a, b) =>
        Number(b.status === "waiting_on_customer") -
        Number(a.status === "waiting_on_customer"),
    );
  const resolved = tickets.filter((ticket) => ticket.status === "resolved");
  const shown = view === "open" ? open : resolved;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_86]">
          {t("portal.list.title")}
        </h1>
        <Link href="/portal/new" className={buttonClass()}>
          <Plus aria-hidden weight="bold" className="size-4" />
          {t("portal.list.newTicket")}
        </Link>
      </header>

      {tickets.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={<Tray aria-hidden weight="duotone" className="size-7" />}
          title={t("portal.list.empty.title")}
          body={t("portal.list.empty.body")}
          action={
            <Link href="/portal/new" className={buttonClass()}>
              {t("portal.list.empty.action")}
            </Link>
          }
        />
      ) : (
        <>
          <nav
            aria-label={t("portal.list.tabsLabel")}
            className="mt-8 inline-flex rounded-full border border-border bg-surface p-1 shadow-soft"
          >
            {(["open", "resolved"] as const).map((key) => {
              const count = key === "open" ? open.length : resolved.length;
              const active = view === key;

              return (
                <Link
                  key={key}
                  href={key === "open" ? "/portal" : "/portal?tab=resolved"}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors",
                    active
                      ? "bg-accent-soft font-semibold text-accent-ink"
                      : "text-ink-soft hover:text-ink",
                  )}
                >
                  {t(`portal.list.${key}`)}
                  <span
                    className={cn(
                      "font-mono text-xs",
                      active ? "text-accent-ink" : "text-ink-soft",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>

          {shown.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={t(
                view === "open"
                  ? "portal.list.emptyOpen.title"
                  : "portal.list.emptyResolved.title",
              )}
              body={t(
                view === "open"
                  ? "portal.list.emptyOpen.body"
                  : "portal.list.emptyResolved.body",
              )}
            />
          ) : (
            <ul className="mt-6 grid gap-3">
              {shown.map((ticket) => (
                <li key={ticket.id}>
                  <Link
                    href={`/portal/tickets/${ticket.id}`}
                    className="group grid grid-cols-[4px_minmax(0,1fr)] overflow-hidden rounded-[8px] border border-border bg-surface shadow-soft transition-[border-color,box-shadow] hover:border-ink-faint hover:shadow-raised"
                  >
                    <span aria-hidden className={statusStripe(ticket.status)} />
                    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                          <span className="font-mono">#{ticket.id}</span>
                          <span>{t(`category.${ticket.category}`)}</span>
                          {ticket.order_reference && (
                            <span className="font-mono">
                              {ticket.order_reference}
                            </span>
                          )}
                        </p>
                        <p className="mt-1 truncate text-base font-semibold text-ink group-hover:text-accent-ink">
                          {ticket.subject}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1.5">
                        <StatusPill
                          status={ticket.status}
                          audience="customer"
                        />
                        <span className="text-xs text-ink-soft">
                          {t.rich("portal.list.updated", {
                            time: () => (
                              <RelativeTime
                                date={ticket.updated_at}
                                serverNow={serverNow}
                              />
                            ),
                          })}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default PortalTicketList;

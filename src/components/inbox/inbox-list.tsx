"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretDown, FunnelSimple, LockSimple, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PriorityLabel } from "@/components/ui/priority-label";
import { RelativeTime } from "@/components/ui/relative-time";
import { SlaBadge } from "@/components/ui/sla-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { LiveIndicator } from "@/components/tickets/live-indicator";
import { statusStripe } from "@/components/tickets/status-stripe";
import { Constants } from "@/lib/supabase/database.types";
import { cn } from "@/lib/cn";
import { DEFAULT_FILTERS, useInbox, type InboxFilters } from "./inbox-provider";

export function InboxList({ serverNow }: { serverNow: number }) {
  const t = useTranslations();
  const inbox = useInbox();
  const { filters, setFilters } = inbox;
  const staffById = Object.fromEntries(inbox.staff.map((s) => [s.id, s]));
  const filtered = (Object.keys(DEFAULT_FILTERS) as Array<keyof InboxFilters>).some((key) => filters[key] !== DEFAULT_FILTERS[key]);

  return (
    <div>
      <div className="sticky top-14 z-10 border-b border-border bg-bg px-4 pt-5 pb-3 sm:px-5 lg:top-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_86]">{t("inbox.title")}</h1>
          <LiveIndicator state={inbox.connection} />
        </div>

        <div className="relative mt-4">
          <label htmlFor="inbox-search" className="sr-only">
            {t("inbox.searchLabel")}
          </label>
          <MagnifyingGlass aria-hidden weight="bold" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            id="inbox-search"
            type="search"
            value={filters.query}
            onChange={(event) => setFilters({ query: event.target.value })}
            placeholder={t("inbox.searchHint")}
            className="h-10 w-full rounded-full border border-border bg-surface pr-4 pl-10 text-sm text-ink shadow-soft placeholder:text-ink-soft/80 hover:border-ink-faint focus:border-accent focus:ring-3 focus:ring-accent/15 focus:outline-none"
          />
        </div>

        <div role="group" aria-label={t("inbox.filtersLabel")} className="mt-3 flex flex-wrap items-center gap-2">
          <FunnelSimple aria-hidden weight="bold" className="size-4 text-ink-soft" />
          <FilterSelect
            label={t("inbox.status")}
            value={filters.status}
            active={filters.status !== DEFAULT_FILTERS.status}
            onChange={(status) => setFilters({ status: status as InboxFilters["status"] })}
            options={[
              { value: "open", label: t("inbox.statusOpen") },
              { value: "all", label: t("inbox.statusAll") },
              ...Constants.public.Enums.ticket_status.map((s) => ({ value: s, label: t(`status.${s}`) })),
            ]}
          />
          <FilterSelect
            label={t("inbox.priority")}
            value={filters.priority}
            active={filters.priority !== DEFAULT_FILTERS.priority}
            onChange={(priority) => setFilters({ priority: priority as InboxFilters["priority"] })}
            options={[
              { value: "any", label: t("inbox.priorityAny") },
              ...[...Constants.public.Enums.ticket_priority].reverse().map((p) => ({ value: p, label: t(`priority.${p}`) })),
            ]}
          />
          <FilterSelect
            label={t("inbox.assignee")}
            value={filters.assignee}
            active={filters.assignee !== DEFAULT_FILTERS.assignee}
            onChange={(assignee) => setFilters({ assignee })}
            options={[
              { value: "anyone", label: t("inbox.assigneeAnyone") },
              { value: "me", label: t("inbox.assigneeMe") },
              { value: "none", label: t("inbox.assigneeNone") },
              ...inbox.staff.filter((s) => s.id !== inbox.viewerId).map((s) => ({ value: s.id, label: s.fullName })),
            ]}
          />
          <FilterSelect
            label={t("inbox.sort")}
            value={filters.sort}
            active={false}
            onChange={(sort) => setFilters({ sort: sort as InboxFilters["sort"] })}
            options={[
              { value: "urgency", label: t("inbox.sortUrgency") },
              { value: "updated", label: t("inbox.sortUpdated") },
              { value: "oldest", label: t("inbox.sortOldest") },
            ]}
          />
        </div>

        <div className="mt-3 flex h-6 items-center justify-between text-xs text-ink-soft">
          <span aria-live="polite">{t("inbox.count", { count: inbox.visible.length })}</span>
          {filtered && (
            <button type="button" onClick={inbox.resetFilters} className="rounded-full px-2 py-0.5 font-medium text-accent-ink hover:bg-accent-soft">
              {t("inbox.clear")}
            </button>
          )}
        </div>
      </div>

      {inbox.visible.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState
            title={t("inbox.empty.title")}
            body={t("inbox.empty.body")}
            action={
              filtered ? (
                <button type="button" onClick={inbox.resetFilters} className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint">
                  {t("inbox.empty.action")}
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {inbox.visible.map((ticket) => {
            const active = inbox.activeId === ticket.id;
            const unread = inbox.unread[ticket.id];
            const assignee = ticket.assigned_agent_id ? staffById[ticket.assigned_agent_id] : undefined;
            return (
              <li key={ticket.id}>
                <Link
                  href={`/inbox/${ticket.id}`}
                  onClick={() => inbox.markRead(ticket.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid grid-cols-[3px_minmax(0,1fr)] transition-colors focus-visible:-outline-offset-2",
                    active ? "bg-accent-soft/55" : "hover:bg-surface-alt/45",
                  )}
                >
                  <span aria-hidden className={statusStripe(ticket.status)} />
                  <div className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate text-sm text-ink", unread ? "font-bold" : "font-semibold")}>{ticket.customerName}</span>
                      {unread && (
                        <span className="shrink-0 rounded-full bg-warm px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                          {unread === "reply" ? t("inbox.newReply") : t("inbox.newTicket")}
                        </span>
                      )}
                      <RelativeTime date={ticket.updated_at} serverNow={serverNow} className="ml-auto shrink-0 font-mono text-[0.6875rem] text-ink-soft" />
                    </div>
                    <p className={cn("mt-0.5 truncate text-[0.9375rem] text-ink", unread && "font-semibold")}>{ticket.subject}</p>
                    {ticket.lastMessage && (
                      <p className="mt-0.5 flex items-center gap-1 text-[0.8125rem] text-ink-soft">
                        {ticket.lastMessage.is_internal_note && <LockSimple aria-hidden weight="bold" className="size-3.5 shrink-0 text-warm-ink" />}
                        <span className="truncate">{ticket.lastMessage.body}</span>
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-[0.6875rem] text-ink-soft">#{ticket.id}</span>
                      <StatusPill status={ticket.status} size="sm" />
                      <PriorityLabel priority={ticket.priority} />
                      <SlaBadge
                        size="sm"
                        hideSettled
                        targetMinutes={inbox.slaTargets[ticket.priority]}
                        status={ticket.status}
                        createdAt={ticket.created_at}
                        firstResponseAt={ticket.first_response_at}
                        serverNow={serverNow}
                      />
                      <span className="ml-auto" title={assignee?.fullName ?? t("inbox.unassigned")}>
                        {assignee ? (
                          <Avatar name={assignee.fullName} tone="staff" size="sm" />
                        ) : (
                          <span className="text-[0.6875rem] text-ink-soft">{t("inbox.unassigned")}</span>
                        )}
                        <span className="sr-only">{assignee?.fullName}</span>
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  active,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  active: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-8 appearance-none rounded-full border pr-8 pl-3 text-[0.8125rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          active ? "border-accent/40 bg-accent-soft font-medium text-accent-ink" : "border-border bg-surface text-ink hover:border-ink-faint",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDown aria-hidden weight="bold" className="pointer-events-none absolute right-2.5 size-3.5 text-ink-soft" />
    </label>
  );
}

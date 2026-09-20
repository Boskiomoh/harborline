"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, CaretDown, ChatCircleText, LockSimple, PaperPlaneRight, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { RelativeTime } from "@/components/ui/relative-time";
import { SlaBadge } from "@/components/ui/sla-badge";
import { LiveIndicator } from "@/components/tickets/live-indicator";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { useLiveTicket } from "@/components/tickets/use-live-ticket";
import { usePostMessageMutation, useUpdateTicketMutation } from "@/lib/queries/tickets";
import { useCannedResponsesQuery } from "@/lib/queries/inbox";
import { Constants, type Enums } from "@/lib/supabase/database.types";
import type { CannedResponse } from "@/lib/inbox";
import type { Person } from "@/lib/tickets";
import { cn } from "@/lib/cn";
import { useInbox } from "./inbox-provider";

type Status = Enums<"ticket_status">;

export function AgentTicketView({ ticketId, viewerId, serverNow }: { ticketId: number; viewerId: string; serverNow: number }) {
  const t = useTranslations();
  const inbox = useInbox();
  const live = useLiveTicket(ticketId);
  const canned = useCannedResponsesQuery();
  const updateMutation = useUpdateTicketMutation(ticketId);

  const { markRead } = inbox;
  useEffect(() => markRead(ticketId), [markRead, ticketId]);

  if (!live.data) return null; // Hydrated from the server prefetch; this never shows in practice.
  const { ticket, messages, events, attachments, people, slaTargets } = live.data;
  const customer = people[ticket.customer_id];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <Link href="/inbox" className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm text-ink-soft hover:text-ink xl:hidden">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {t("inbox.detail.back")}
      </Link>

      <header className="mt-3 xl:mt-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
          <span className="font-mono">#{ticket.id}</span>
          <span>{t(`category.${ticket.category}`)}</span>
          {ticket.order_reference && <span className="font-mono">{t("inbox.detail.order", { ref: ticket.order_reference })}</span>}
          <span>{t.rich("inbox.detail.opened", { time: () => <RelativeTime date={ticket.created_at} serverNow={serverNow} /> })}</span>
          <LiveIndicator state={live.connection} className="ml-auto" />
        </div>
        <h1 className="mt-2 font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_88]">
          {ticket.subject}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {customer && (
            <span className="inline-flex items-center gap-2 text-sm">
              <Avatar name={customer.fullName} size="sm" />
              <span className="font-semibold text-ink">{customer.fullName}</span>
              <span className="text-ink-soft">{t("inbox.detail.customer")}</span>
            </span>
          )}
          <SlaBadge
            className="sm:ml-auto"
            targetMinutes={slaTargets[ticket.priority]}
            status={ticket.status}
            createdAt={ticket.created_at}
            firstResponseAt={ticket.first_response_at}
            serverNow={serverNow}
          />
        </div>
      </header>

      <div className="mt-5 grid gap-3 rounded-[8px] border border-border bg-surface p-3 shadow-soft sm:grid-cols-3 sm:p-4">
        <ControlSelect
          id="ticket-status"
          label={t("inbox.detail.statusLabel")}
          value={ticket.status}
          onChange={(status) => updateMutation.mutate({ status: status as Status })}
          options={Constants.public.Enums.ticket_status.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />
        <ControlSelect
          id="ticket-priority"
          label={t("inbox.detail.priorityLabel")}
          value={ticket.priority}
          onChange={(value) => updateMutation.mutate({ priority: value as Enums<"ticket_priority"> })}
          options={[...Constants.public.Enums.ticket_priority].reverse().map((p) => ({ value: p, label: t(`priority.${p}`) }))}
        />
        <div>
          <ControlSelect
            id="ticket-assignee"
            label={t("inbox.detail.assigneeLabel")}
            value={ticket.assigned_agent_id ?? ""}
            onChange={(value) => updateMutation.mutate({ assignedAgentId: value || null })}
            options={[{ value: "", label: t("inbox.unassigned") }, ...inbox.staff.map((s) => ({ value: s.id, label: s.fullName }))]}
          />
          {ticket.assigned_agent_id !== viewerId && (
            <button
              type="button"
              onClick={() => updateMutation.mutate({ assignedAgentId: viewerId })}
              className="mt-1.5 text-[0.8125rem] font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              {t("inbox.detail.assignToMe")}
            </button>
          )}
        </div>
      </div>

      {updateMutation.isError && (
        <Banner tone="error" className="mt-3">
          {t("inbox.detail.saveError")}
        </Banner>
      )}

      <TicketThread
        className="mt-8"
        messages={messages}
        events={events}
        attachments={attachments}
        people={people}
        viewerId={viewerId}
        audience="staff"
        serverNow={serverNow}
      />

      <AgentComposer ticketId={ticket.id} customerName={customer?.fullName ?? ""} canned={canned.data ?? []} staff={inbox.staff} />
    </div>
  );
}

function ControlSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} h-10 appearance-none pr-9 text-sm`}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <CaretDown aria-hidden weight="bold" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-soft" />
      </div>
    </div>
  );
}

function AgentComposer({
  ticketId,
  customerName,
  canned,
  staff,
}: {
  ticketId: number;
  customerName: string;
  canned: CannedResponse[];
  staff: Person[];
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [thenStatus, setThenStatus] = useState<"" | Status>("");
  const [error, setError] = useState<string | null>(null);
  const mutation = usePostMessageMutation(ticketId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const firstName = customerName.split(" ")[0] ?? "";
  const note = mode === "note";

  const send = () => {
    if (!body.trim()) {
      setError(t("inbox.composer.errors.empty"));
      return;
    }
    setError(null);
    const setStatus = !note && thenStatus ? thenStatus : undefined;
    mutation.mutate(
      { body, internal: note, setStatus },
      {
        onSuccess: () => {
          setBody("");
          setThenStatus("");
        },
        onError: () => setError(t("inbox.composer.errors.generic")),
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      className={cn(
        "mt-8 rounded-[8px] border p-4 transition-colors sm:p-5",
        note ? "border-dashed border-warm/45 bg-warm-soft/60" : "border-border bg-surface shadow-raised",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={t("inbox.composer.modeLabel")} className="inline-flex rounded-full border border-border bg-bg p-0.5">
          {(["reply", "note"] as const).map((value) => {
            const checked = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setMode(value)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors",
                  checked ? (value === "note" ? "bg-warm-soft font-semibold text-warm-ink" : "bg-surface font-semibold text-ink shadow-soft") : "text-ink-soft hover:text-ink",
                )}
              >
                {value === "note" ? <LockSimple aria-hidden weight="bold" className="size-3.5" /> : <PaperPlaneRight aria-hidden weight="bold" className="size-3.5" />}
                {t(`inbox.composer.${value}`)}
              </button>
            );
          })}
        </div>
        {!note && canned.length > 0 && (
          <CannedPicker
            items={canned}
            staff={staff}
            onPick={(text) => {
              setBody((current) => (current.trim() ? `${current.trimEnd()}\n\n${text}` : text).replaceAll("{first_name}", firstName));
              textareaRef.current?.focus();
            }}
          />
        )}
      </div>

      <label htmlFor="composer" className="mt-4 block text-sm font-semibold text-ink">
        {note ? t("inbox.composer.noteLabel") : t("inbox.composer.replyLabel", { name: customerName })}
      </label>
      {note && <p className="mt-0.5 text-[0.8125rem] text-warm-ink">{t("inbox.composer.noteHint")}</p>}
      <textarea
        ref={textareaRef}
        id="composer"
        rows={5}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "composer-error" : "composer-shortcut"}
        className={cn(inputClass, "mt-2 resize-y py-3 leading-relaxed", note && "border-warm/40 focus:border-warm focus:ring-warm/15")}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {error ? (
          <p id="composer-error" role="alert" className="text-[0.8125rem] font-medium text-danger">
            {error}
          </p>
        ) : (
          <p id="composer-shortcut" className="hidden text-xs text-ink-soft sm:block">
            {t("inbox.composer.shortcut")}
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!note && (
            <label className="relative inline-flex items-center gap-2 text-sm text-ink-soft">
              <span>{t("inbox.composer.thenSet")}</span>
              <span className="relative">
                <select
                  value={thenStatus}
                  onChange={(event) => setThenStatus(event.target.value as "" | Status)}
                  className="h-10 appearance-none rounded-full border border-border bg-surface pr-8 pl-3.5 text-sm text-ink hover:border-ink-faint"
                >
                  <option value="">{t("inbox.composer.keepStatus")}</option>
                  <option value="waiting_on_customer">{t("status.waiting_on_customer")}</option>
                  <option value="resolved">{t("status.resolved")}</option>
                </select>
                <CaretDown aria-hidden weight="bold" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-soft" />
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending || undefined}
            className={cn(buttonClass(), note && "bg-warm-ink hover:bg-warm-ink/90")}
          >
            {mutation.isPending ? <SpinnerGap aria-hidden weight="bold" className="size-4 motion-safe:animate-spin" /> : note ? <LockSimple aria-hidden weight="bold" className="size-4" /> : <PaperPlaneRight aria-hidden weight="bold" className="size-4" />}
            {mutation.isPending ? t("inbox.composer.sending") : note ? t("inbox.composer.addNote") : t("inbox.composer.send")}
          </button>
        </div>
      </div>
    </form>
  );
}

function CannedPicker({ items, staff, onPick }: { items: CannedResponse[]; staff: Person[]; onPick: (body: string) => void }) {
  const t = useTranslations("inbox.composer");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const names = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s.fullName])), [staff]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = items.filter((item) => !q || item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="canned-panel"
        onClick={() => setOpen((value) => !value)}
        className={buttonClass({ variant: "secondary", size: "sm" })}
      >
        <ChatCircleText aria-hidden weight="bold" className="size-4" />
        {t("canned")}
      </button>
      {open && (
        <div id="canned-panel" className="absolute top-full right-0 z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-[8px] border border-border bg-surface p-2 shadow-float">
          <label htmlFor="canned-search" className="sr-only">
            {t("cannedSearch")}
          </label>
          <input
            ref={searchRef}
            id="canned-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("cannedSearch")}
            className={`${inputClass} h-9 text-sm`}
          />
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-ink-soft">{t("cannedEmpty")}</p>
          ) : (
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {filtered.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(item.body);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full rounded-[6px] px-3 py-2.5 text-left transition-colors hover:bg-surface-alt focus-visible:bg-surface-alt"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-ink">{item.title}</span>
                      {names[item.agent_id] && <span className="shrink-0 text-[0.6875rem] text-ink-soft">{t("cannedBy", { name: names[item.agent_id] })}</span>}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-ink-soft">{item.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

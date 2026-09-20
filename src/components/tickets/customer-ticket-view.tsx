"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, PaperPlaneRight, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { usePostMessageMutation } from "@/lib/queries/tickets";
import { LiveIndicator } from "./live-indicator";
import { TicketThread } from "./ticket-thread";
import { useLiveTicket } from "./use-live-ticket";

export function CustomerTicketView({
  ticketId,
  viewerId,
  serverNow,
  created,
  uploadFailed,
}: {
  ticketId: number;
  viewerId: string;
  serverNow: number;
  created: boolean;
  uploadFailed: boolean;
}) {
  const t = useTranslations();
  const live = useLiveTicket(ticketId);
  if (!live.data) return null; // Hydrated from the server prefetch; this never shows in practice.
  const { ticket, messages, events, attachments, people } = live.data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <Link href="/portal" className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {t("portal.ticket.back")}
      </Link>

      <header className="mt-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="font-mono">#{ticket.id}</span>
          <span>{t(`category.${ticket.category}`)}</span>
          {ticket.order_reference && <span className="font-mono">{t("portal.ticket.order", { ref: ticket.order_reference })}</span>}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_88] sm:text-4xl">
          {ticket.subject}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusPill status={ticket.status} audience="customer" />
          <span className="text-sm text-ink-soft">
            {t.rich("portal.ticket.opened", { time: () => <RelativeTime date={ticket.created_at} serverNow={serverNow} /> })}
          </span>
          <LiveIndicator state={live.connection} className="sm:ml-auto" />
        </div>
      </header>

      <div className="mt-6 grid gap-3 empty:hidden">
        {created && <Banner tone="success">{t("portal.ticket.created")}</Banner>}
        {uploadFailed && <Banner tone="error">{t("portal.ticket.uploadFailed")}</Banner>}
        {ticket.status === "waiting_on_customer" && <Banner tone="waiting">{t("portal.ticket.waiting")}</Banner>}
      </div>

      <TicketThread
        className="mt-8"
        messages={messages}
        events={events}
        attachments={attachments}
        people={people}
        viewerId={viewerId}
        audience="customer"
        serverNow={serverNow}
      />

      <CustomerReply ticketId={ticket.id} resolved={ticket.status === "resolved"} />
    </div>
  );
}

function CustomerReply({ ticketId, resolved }: { ticketId: number; resolved: boolean }) {
  const t = useTranslations("portal.ticket");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = usePostMessageMutation(ticketId);

  const send = () => {
    if (!body.trim()) {
      setError(t("errors.empty"));
      return;
    }
    setError(null);
    mutation.mutate(
      { body, internal: false },
      {
        onSuccess: () => setBody(""),
        onError: () => setError(t("errors.generic")),
      },
    );
  };

  return (
    <form
      className="mt-8 rounded-[8px] border border-border bg-surface p-4 shadow-raised sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <label htmlFor="reply" className="text-sm font-semibold text-ink">
        {t("replyLabel")}
      </label>
      <textarea
        id="reply"
        rows={4}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "reply-error" : resolved ? "reply-hint" : undefined}
        className={`${inputClass} mt-2 resize-y py-3 leading-relaxed`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[0.8125rem]">
          {error ? (
            <p id="reply-error" role="alert" className="font-medium text-danger">
              {error}
            </p>
          ) : (
            resolved && (
              <p id="reply-hint" className="text-ink-soft">
                {t("reopenHint")}
              </p>
            )
          )}
        </div>
        <button type="submit" disabled={mutation.isPending} aria-busy={mutation.isPending || undefined} className={buttonClass({ className: "ml-auto" })}>
          {mutation.isPending ? (
            <SpinnerGap aria-hidden weight="bold" className="size-4 motion-safe:animate-spin" />
          ) : (
            <PaperPlaneRight aria-hidden weight="bold" className="size-4" />
          )}
          {mutation.isPending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
}

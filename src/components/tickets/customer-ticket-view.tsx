"use client";

import { Banner } from "@/components/ui/banner";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { useToast } from "@/components/ui/toaster";
import { useSingleTicket } from "@/hooks/use-app-hooks/use-tickets";
import useLiveTicket from "@/hooks/use-live-ticket";
import { apiInstance } from "@/lib/api/instance";
import type { TicketDetail } from "@/lib/tickets";
import {
  ArrowLeft,
  PaperPlaneRight,
  SpinnerGap,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC, useState } from "react";
import LiveIndicator from "./live-indicator";
import TicketThread from "./ticket-thread";

interface CustomerReplyProps {
  ticketId: number;
  resolved: boolean;
}

const CustomerReply: FC<CustomerReplyProps> = ({ ticketId, resolved }) => {
  const t = useTranslations("portal.ticket");
  const toast = useToast();

  // State
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Queries
  const { refetch: ticketRefetch } = useSingleTicket(ticketId);

  // Mutations
  const { mutate: postReplyMutate, isPending: postReplyPending } = useMutation({
    mutationKey: ["post-reply", ticketId],
    mutationFn: async () => {
      try {
        const res = await apiInstance.post(
          `/api/tickets/${ticketId}/messages`,
          { body, internal: false },
        );

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await ticketRefetch();
      setBody("");
      toast({ title: t("sent"), description: t("sentBody") });
    },
    onError: () => setError(t("errors.generic")),
  });

  // Handlers
  const handleSend = () => {
    if (!body.trim()) {
      setError(t("errors.empty"));
      return;
    }

    setError(null);
    postReplyMutate();
  };

  return (
    <form
      className="mt-8 rounded-[8px] border border-border bg-surface p-4 shadow-raised sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        handleSend();
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
            handleSend();
          }
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? "reply-error" : resolved ? "reply-hint" : undefined
        }
        className={`${inputClass} mt-2 resize-y py-3 leading-relaxed`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[0.8125rem]">
          {error ? (
            <p
              id="reply-error"
              role="alert"
              className="font-medium text-danger"
            >
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
        <button
          type="submit"
          disabled={postReplyPending}
          aria-busy={postReplyPending || undefined}
          className={buttonClass({ className: "ml-auto" })}
        >
          {postReplyPending ? (
            <SpinnerGap
              aria-hidden
              weight="bold"
              className="size-4 motion-safe:animate-spin"
            />
          ) : (
            <PaperPlaneRight aria-hidden weight="bold" className="size-4" />
          )}
          {postReplyPending ? t("sending") : t("send")}
        </button>
      </div>
    </form>
  );
};

interface CustomerTicketViewProps {
  ticketId: number;
  viewerId: string;
  serverNow: number;
  created: boolean;
  uploadFailed: boolean;
}

const CustomerTicketView: FC<CustomerTicketViewProps> = ({
  ticketId,
  viewerId,
  serverNow,
  created,
  uploadFailed,
}) => {
  const t = useTranslations();

  // Queries
  const { data: ticketData } = useSingleTicket(ticketId);
  const connection = useLiveTicket(ticketId);
  const detail: TicketDetail | undefined = ticketData;

  // Hydrated from the server prefetch; this never shows in practice.
  if (!detail) return null;

  const { ticket, messages, events, attachments, people } = detail;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10">
      <Link
        href="/portal"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {t("portal.ticket.back")}
      </Link>

      <header className="mt-5">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="font-mono">#{ticket.id}</span>
          <span>{t(`category.${ticket.category}`)}</span>
          {ticket.order_reference && (
            <span className="font-mono">
              {t("portal.ticket.order", { ref: ticket.order_reference })}
            </span>
          )}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_88] sm:text-4xl">
          {ticket.subject}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusPill status={ticket.status} audience="customer" />
          <span className="text-sm text-ink-soft">
            {t.rich("portal.ticket.opened", {
              time: () => (
                <RelativeTime date={ticket.created_at} serverNow={serverNow} />
              ),
            })}
          </span>
          <LiveIndicator state={connection} className="sm:ml-auto" />
        </div>
      </header>

      <div className="mt-6 grid gap-3 empty:hidden">
        {created && (
          <Banner tone="success">{t("portal.ticket.created")}</Banner>
        )}
        {uploadFailed && (
          <Banner tone="error">{t("portal.ticket.uploadFailed")}</Banner>
        )}
        {ticket.status === "waiting_on_customer" && (
          <Banner tone="waiting">{t("portal.ticket.waiting")}</Banner>
        )}
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

      <CustomerReply
        ticketId={ticket.id}
        resolved={ticket.status === "resolved"}
      />
    </div>
  );
};

export default CustomerTicketView;

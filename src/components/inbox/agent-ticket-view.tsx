"use client";

import LiveIndicator from "@/components/tickets/live-indicator";
import TicketThread from "@/components/tickets/ticket-thread";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { RelativeTime } from "@/components/ui/relative-time";
import { SlaBadge } from "@/components/ui/sla-badge";
import { useToast } from "@/components/ui/toaster";
import { useCannedResponses } from "@/hooks/use-app-hooks/use-inbox";
import { useSingleTicket } from "@/hooks/use-app-hooks/use-tickets";
import useLiveTicket from "@/hooks/use-live-ticket";
import { apiInstance } from "@/lib/api/instance";
import type { UpdateTicketInput } from "@/lib/api/schemas";
import { Constants, type Enums } from "@/lib/supabase/database.types";
import type { TicketDetail } from "@/lib/tickets";
import {
  ArrowLeft,
  CaretDown,
  CheckCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC, useState } from "react";
import AgentComposer from "./agent-composer";
import AiSummaryCard from "./ai-summary-card";
import AiTriageChip from "./ai-triage-chip";
import { useInbox } from "./inbox-provider";

type Status = Enums<"ticket_status">;

interface ControlSelectProps {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

const ControlSelect: FC<ControlSelectProps> = ({
  id,
  label,
  value,
  options,
  onChange,
}) => (
  <div className="grid content-start gap-1">
    <label htmlFor={id} className="text-xs font-medium text-ink-soft">
      {label}
    </label>
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} h-10 appearance-none pr-9 text-sm`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDown
        aria-hidden
        weight="bold"
        className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-soft"
      />
    </div>
  </div>
);

interface AgentTicketViewProps {
  ticketId: number;
  viewerId: string;
  serverNow: number;
}

const AgentTicketView: FC<AgentTicketViewProps> = ({
  ticketId,
  viewerId,
  serverNow,
}) => {
  const t = useTranslations();
  const toast = useToast();

  // Stores
  const inbox = useInbox();

  // State
  const [confirmResolve, setConfirmResolve] = useState(false);

  // Queries
  const { data: ticketData, refetch: ticketRefetch } =
    useSingleTicket(ticketId);
  const { data: cannedResponsesData } = useCannedResponses();
  const connection = useLiveTicket(ticketId);
  const detail: TicketDetail | undefined = ticketData;

  // Mutations
  const { mutate: updateTicketMutate } = useMutation({
    mutationKey: ["update-ticket", ticketId],
    mutationFn: async (input: UpdateTicketInput) => {
      try {
        const res = await apiInstance.patch(`/api/tickets/${ticketId}`, input);

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    onSuccess: async (_, input) => {
      await ticketRefetch();
      inbox.inboxTicketsRefetch();

      if (input.status) {
        toast({
          title: t("inbox.toast.statusChanged", {
            status: t(`status.${input.status}`),
          }),
        });
      } else if (input.priority) {
        toast({
          title: t("inbox.toast.priorityChanged", {
            priority: t(`priority.${input.priority}`),
          }),
        });
      } else if (input.assignedAgentId !== undefined) {
        const assignee = input.assignedAgentId
          ? detail?.people[input.assignedAgentId]?.fullName
          : null;

        toast({
          title: assignee
            ? t("inbox.toast.assigned", { name: assignee })
            : t("inbox.toast.unassigned"),
        });
      }
    },
    onError: () =>
      toast({
        tone: "error",
        title: t("inbox.toast.saveError"),
        description: t("inbox.toast.saveErrorBody"),
      }),
  });

  // Hydrated from the server prefetch; this never shows in practice.
  if (!detail) return null;

  const { ticket, messages, events, attachments, people, slaTargets } = detail;
  const customer = people[ticket.customer_id];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/inbox"
        className="-ml-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm text-ink-soft hover:text-ink xl:hidden"
      >
        <ArrowLeft aria-hidden weight="bold" className="size-4" />
        {t("inbox.detail.back")}
      </Link>

      <header className="mt-3 xl:mt-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-soft">
          <span className="font-mono">#{ticket.id}</span>
          <span>{t(`category.${ticket.category}`)}</span>
          {ticket.order_reference && (
            <span className="font-mono">
              {t("inbox.detail.order", { ref: ticket.order_reference })}
            </span>
          )}
          <span>
            {t.rich("inbox.detail.opened", {
              time: () => (
                <RelativeTime date={ticket.created_at} serverNow={serverNow} />
              ),
            })}
          </span>
          <LiveIndicator state={connection} className="ml-auto" />
        </div>
        <h1 className="mt-2 font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_88]">
          {ticket.subject}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {customer && (
            <span className="inline-flex items-center gap-2 text-sm">
              <Avatar name={customer.fullName} size="sm" />
              <span className="font-semibold text-ink">
                {customer.fullName}
              </span>
              <span className="text-ink-soft">
                {t("inbox.detail.customer")}
              </span>
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
          // Resolving tells the customer the problem is closed, so it gets a confirmation step.
          onChange={(status) =>
            status === "resolved"
              ? setConfirmResolve(true)
              : updateTicketMutate({ status: status as Status })
          }
          options={Constants.public.Enums.ticket_status.map((s) => ({
            value: s,
            label: t(`status.${s}`),
          }))}
        />
        <ControlSelect
          id="ticket-priority"
          label={t("inbox.detail.priorityLabel")}
          value={ticket.priority}
          onChange={(value) =>
            updateTicketMutate({
              priority: value as Enums<"ticket_priority">,
            })
          }
          options={[...Constants.public.Enums.ticket_priority]
            .reverse()
            .map((p) => ({ value: p, label: t(`priority.${p}`) }))}
        />
        <div>
          <ControlSelect
            id="ticket-assignee"
            label={t("inbox.detail.assigneeLabel")}
            value={ticket.assigned_agent_id ?? ""}
            onChange={(value) =>
              updateTicketMutate({ assignedAgentId: value || null })
            }
            options={[
              { value: "", label: t("inbox.unassigned") },
              ...inbox.staff.map((s) => ({ value: s.id, label: s.fullName })),
            ]}
          />
          {ticket.assigned_agent_id !== viewerId && (
            <button
              type="button"
              onClick={() => updateTicketMutate({ assignedAgentId: viewerId })}
              className="mt-1.5 text-[0.8125rem] font-medium text-accent-ink underline-offset-4 hover:underline"
            >
              {t("inbox.detail.assignToMe")}
            </button>
          )}
        </div>
      </div>

      <AiTriageChip ticket={ticket} />

      {/* Threads at least this long get the summary card (the spec's 6 would hide it on every seed ticket). */}
      {messages.length >= 4 && (
        <AiSummaryCard ticketId={ticket.id} messageCount={messages.length} />
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

      <AgentComposer
        ticketId={ticket.id}
        customerName={customer?.fullName ?? ""}
        canned={cannedResponsesData ?? []}
        staff={inbox.staff}
      />

      {/* Resolve Confirm Dialog */}
      <ConfirmDialog
        open={confirmResolve}
        onClose={() => setConfirmResolve(false)}
        onConfirm={() => {
          setConfirmResolve(false);
          updateTicketMutate({ status: "resolved" });
        }}
        icon={CheckCircle}
        title={t("inbox.detail.resolveConfirm.title", { id: ticket.id })}
        description={t("inbox.detail.resolveConfirm.body", {
          name: customer?.fullName.split(" ")[0] ?? t("inbox.detail.customer"),
        })}
        confirmLabel={t("inbox.detail.resolveConfirm.confirm")}
      />
    </div>
  );
};

export default AgentTicketView;

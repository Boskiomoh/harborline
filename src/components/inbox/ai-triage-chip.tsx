"use client";

import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { useTriageSuggestion } from "@/hooks/use-app-hooks/use-ai";
import { useSingleTicket } from "@/hooks/use-app-hooks/use-tickets";
import { apiInstance } from "@/lib/api/instance";
import type { TicketCore } from "@/lib/tickets";
import { Check, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FC } from "react";
import AiErrorNote from "./ai-error-note";
import AiMark from "./ai-mark";
import { useInbox } from "./inbox-provider";

interface AiTriageChipProps {
  ticket: TicketCore;
}

// Suggested category/priority for a new ticket (docs/AI-ASSIST.md step M).
// Accept goes through the same PATCH as the manual selects; Dismiss only hides
// it for this session. Once anyone sets category or priority by hand the
// database stamps `triaged_at` and the chip never shows again.
const AiTriageChip: FC<AiTriageChipProps> = ({ ticket }) => {
  const t = useTranslations();
  const toast = useToast();

  // Stores
  const { dismissedTriage, dismissTriage, inboxTicketsRefetch } = useInbox();

  // Derived
  const showTriage =
    ticket.status === "new" &&
    !ticket.triaged_at &&
    !dismissedTriage.includes(ticket.id);

  // Queries
  const { refetch: ticketRefetch } = useSingleTicket(ticket.id);
  const {
    data: triageData,
    isPending: triageLoading,
    error: triageError,
  } = useTriageSuggestion({ ticketId: ticket.id, enabled: showTriage });

  // Mutations
  const { mutate: acceptTriageMutate, isPending: acceptTriagePending } =
    useMutation({
      mutationKey: ["accept-triage", ticket.id],
      mutationFn: async () => {
        try {
          const body = {
            ...(triageData.category !== ticket.category && {
              category: triageData.category,
            }),
            ...(triageData.priority !== ticket.priority && {
              priority: triageData.priority,
            }),
          };

          const res = await apiInstance.patch(
            `/api/tickets/${ticket.id}`,
            body,
          );

          return res.data;
        } catch (error) {
          throw error;
        }
      },
      onSuccess: async () => {
        await ticketRefetch();
        inboxTicketsRefetch();
        toast({ title: t("inbox.ai.triage.accepted") });
      },
      onError: () =>
        toast({
          tone: "error",
          title: t("inbox.toast.saveError"),
          description: t("inbox.toast.saveErrorBody"),
        }),
    });

  if (!showTriage) return null;

  if (triageLoading) {
    return (
      <p
        role="status"
        className="mt-3 inline-flex h-8 items-center gap-2 text-[0.8125rem] text-ink-soft"
      >
        <SpinnerGap
          aria-hidden
          weight="bold"
          className="size-3.5 motion-safe:animate-spin"
        />
        {t("inbox.ai.triage.loading")}
      </p>
    );
  }

  if (triageError) return <AiErrorNote className="mt-3" error={triageError} />;

  if (
    triageData.status !== "suggestion" ||
    (triageData.category === ticket.category &&
      triageData.priority === ticket.priority)
  ) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] border border-accent/25 bg-accent-soft/55 py-2 pr-2 pl-2.5 text-sm text-accent-ink">
      <AiMark className="size-7 bg-surface" />
      <p className="min-w-0 flex-1 basis-48">
        {t.rich("inbox.ai.triage.suggestion", {
          category: t(`category.${triageData.category}`),
          priority: t(`priority.${triageData.priority}`),
          b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
        })}
        {triageData.confidence < 0.6 && (
          <span className="ml-2 text-[0.8125rem] text-ink-soft">
            {t("inbox.ai.triage.lowConfidence")}
          </span>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => acceptTriageMutate()}
          disabled={acceptTriagePending}
          aria-busy={acceptTriagePending || undefined}
          className={buttonClass({ size: "sm" })}
        >
          {acceptTriagePending ? (
            <SpinnerGap
              aria-hidden
              weight="bold"
              className="size-4 motion-safe:animate-spin"
            />
          ) : (
            <Check aria-hidden weight="bold" className="size-4" />
          )}
          {t("inbox.ai.triage.accept")}
        </button>
        <button
          type="button"
          onClick={() => dismissTriage(ticket.id)}
          disabled={acceptTriagePending}
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          {t("inbox.ai.triage.dismiss")}
        </button>
      </div>
    </div>
  );
};

export default AiTriageChip;

"use client";

import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Check, SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import type { AiTriageResponse } from "@/lib/api/schemas";
import { useTriageSuggestionQuery } from "@/lib/queries/ai";
import { useUpdateTicketMutation } from "@/lib/queries/tickets";
import { qk } from "@/lib/query/keys";
import type { TicketCore } from "@/lib/tickets";
import { AiErrorNote, AiMark } from "./ai-shared";

/**
 * Suggested category/priority for a new ticket (docs/AI-ASSIST.md step M). Accept goes through
 * the same PATCH /api/tickets/[id] as the manual selects; Dismiss only hides it for this session.
 * The server stops suggesting once anyone sets category or priority by hand (`triaged_at`).
 */
export function AiTriageChip({ ticket }: { ticket: TicketCore }) {
  const t = useTranslations();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isNew = ticket.status === "new";
  const suggestion = useTriageSuggestionQuery(ticket.id, { enabled: isNew });
  const update = useUpdateTicketMutation(ticket.id);

  if (!isNew) return null;

  if (suggestion.isPending) {
    return (
      <p role="status" className="mt-3 inline-flex h-8 items-center gap-2 text-[0.8125rem] text-ink-soft">
        <SpinnerGap aria-hidden weight="bold" className="size-3.5 motion-safe:animate-spin" />
        {t("inbox.ai.triage.loading")}
      </p>
    );
  }

  if (suggestion.isError) return <AiErrorNote className="mt-3" error={suggestion.error} />;

  const data = suggestion.data;
  if (data.status !== "suggestion") return null;

  const categoryChanged = data.category !== ticket.category;
  const priorityChanged = data.priority !== ticket.priority;
  if (!categoryChanged && !priorityChanged) return null;

  const dismiss = () => {
    const dismissed: AiTriageResponse = { status: "skipped", reason: "dismissed" };
    queryClient.setQueryData(qk.aiTriage(ticket.id), dismissed);
  };

  const accept = () =>
    update.mutate(
      { ...(categoryChanged && { category: data.category }), ...(priorityChanged && { priority: data.priority }) },
      {
        onSuccess: () => toast({ title: t("inbox.ai.triage.accepted") }),
        onError: () => toast({ tone: "error", title: t("inbox.toast.saveError"), description: t("inbox.toast.saveErrorBody") }),
      },
    );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] border border-accent/25 bg-accent-soft/55 py-2 pr-2 pl-2.5 text-sm text-accent-ink">
      <AiMark className="size-7 bg-surface" />
      <p className="min-w-0 flex-1 basis-48">
        {t.rich("inbox.ai.triage.suggestion", {
          category: t(`category.${data.category}`),
          priority: t(`priority.${data.priority}`),
          b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
        })}
        {data.confidence < 0.6 && <span className="ml-2 text-[0.8125rem] text-ink-soft">{t("inbox.ai.triage.lowConfidence")}</span>}
      </p>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={accept} disabled={update.isPending} aria-busy={update.isPending || undefined} className={buttonClass({ size: "sm" })}>
          {update.isPending ? <SpinnerGap aria-hidden weight="bold" className="size-4 motion-safe:animate-spin" /> : <Check aria-hidden weight="bold" className="size-4" />}
          {t("inbox.ai.triage.accept")}
        </button>
        <button type="button" onClick={dismiss} disabled={update.isPending} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {t("inbox.ai.triage.dismiss")}
        </button>
      </div>
    </div>
  );
}

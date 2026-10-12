"use client";

import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiInstance } from "@/lib/api/instance";
import { cn } from "@/lib/cn";
import {
  ArrowClockwise,
  CaretDown,
  LockSimple,
  Notepad,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FC, useId, useState } from "react";
import AiErrorNote from "./ai-error-note";
import AiMark from "./ai-mark";

interface AiSummaryCardProps {
  ticketId: number;
  messageCount: number;
}

// "Summarize thread" (docs/AI-ASSIST.md step N). Rendered with the ticket, not
// after a fetch, so it never pops in and shifts the thread; the summary itself
// only appears when the agent asks.
const AiSummaryCard: FC<AiSummaryCardProps> = ({ ticketId, messageCount }) => {
  const t = useTranslations("inbox.ai.summary");
  const regionId = useId();

  // State
  const [open, setOpen] = useState(true);

  // Mutations
  const {
    mutate: summarizeMutate,
    data: summarizeData,
    isPending: summarizePending,
    isSuccess: summarizeSuccess,
    error: summarizeError,
  } = useMutation({
    mutationKey: ["summarize-ticket", ticketId],
    mutationFn: async () => {
      try {
        const res = await apiInstance.post(
          `/api/tickets/${ticketId}/ai/summary`,
        );

        return res.data;
      } catch (error) {
        throw error;
      }
    },
  });

  return (
    <section
      aria-labelledby={`${regionId}-title`}
      className="mt-5 rounded-[8px] border border-border bg-surface p-4 shadow-soft"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiMark />
        <div className="min-w-0 flex-1 basis-48">
          <h2
            id={`${regionId}-title`}
            className="text-sm font-semibold text-ink"
          >
            {t("title")}
          </h2>
          {!summarizeSuccess && (
            <p className="text-[0.8125rem] text-ink-soft">
              {t("intro", { count: messageCount })}
            </p>
          )}
        </div>
        {summarizeSuccess ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => summarizeMutate()}
              className={buttonClass({ variant: "ghost", size: "sm" })}
              title={t("again")}
            >
              <ArrowClockwise aria-hidden weight="bold" className="size-4" />
              <span className="sr-only sm:not-sr-only">{t("again")}</span>
            </button>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={regionId}
              onClick={() => setOpen((value) => !value)}
              className="grid size-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
            >
              <CaretDown
                aria-hidden
                weight="bold"
                className={cn(
                  "size-4 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
              <span className="sr-only">{open ? t("hide") : t("show")}</span>
            </button>
          </div>
        ) : (
          !summarizePending && (
            <button
              type="button"
              onClick={() => summarizeMutate()}
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <Notepad aria-hidden weight="bold" className="size-4" />
              {t("start")}
            </button>
          )
        )}
      </div>

      {summarizePending && (
        <div
          role="status"
          aria-label={t("loading")}
          className="mt-3.5 grid gap-2.5 sm:pl-11"
        >
          <Skeleton className="h-3.5 w-[94%]" />
          <Skeleton className="h-3.5 w-[88%]" />
          <Skeleton className="h-3.5 w-[64%]" />
        </div>
      )}

      {summarizeError && (
        <AiErrorNote
          className="mt-3 sm:pl-11"
          error={summarizeError}
          onRetry={() => summarizeMutate()}
        />
      )}

      {summarizeSuccess && open && (
        <div id={regionId} className="mt-3 sm:pl-11">
          <p className="max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink">
            {summarizeData.summary}
          </p>
          {summarizeData.includesInternalNotes && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.8125rem] text-warm-ink">
              <LockSimple aria-hidden weight="bold" className="size-3.5" />
              {t("internal")}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default AiSummaryCard;

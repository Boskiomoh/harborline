"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowClockwise, CaretDown, LockSimple, Notepad } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { useSummaryMutation } from "@/lib/queries/ai";
import { AiErrorNote, AiMark } from "./ai-shared";

/**
 * "Summarize thread" (docs/AI-ASSIST.md step N). Rendered with the ticket (not after a fetch),
 * so it never pops in and shifts the thread; the summary itself only appears when the agent asks.
 * The parent decides when a thread is long enough to be worth it.
 */
export function AiSummaryCard({ ticketId, messageCount }: { ticketId: number; messageCount: number }) {
  const t = useTranslations("inbox.ai.summary");
  const summary = useSummaryMutation(ticketId);
  const [open, setOpen] = useState(true);
  const regionId = useId();
  const hasResult = summary.isSuccess;

  return (
    <section aria-labelledby={`${regionId}-title`} className="mt-5 rounded-[8px] border border-border bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiMark />
        <div className="min-w-0 flex-1 basis-48">
          <h2 id={`${regionId}-title`} className="text-sm font-semibold text-ink">
            {t("title")}
          </h2>
          {!hasResult && <p className="text-[0.8125rem] text-ink-soft">{t("intro", { count: messageCount })}</p>}
        </div>
        {hasResult ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => summary.mutate()} className={buttonClass({ variant: "ghost", size: "sm" })} title={t("again")}>
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
              <CaretDown aria-hidden weight="bold" className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
              <span className="sr-only">{open ? t("hide") : t("show")}</span>
            </button>
          </div>
        ) : (
          !summary.isPending && (
            <button type="button" onClick={() => summary.mutate()} className={buttonClass({ variant: "secondary", size: "sm" })}>
              <Notepad aria-hidden weight="bold" className="size-4" />
              {t("start")}
            </button>
          )
        )}
      </div>

      {summary.isPending && (
        <div role="status" aria-label={t("loading")} className="mt-3.5 grid gap-2.5 sm:pl-11">
          <Skeleton className="h-3.5 w-[94%]" />
          <Skeleton className="h-3.5 w-[88%]" />
          <Skeleton className="h-3.5 w-[64%]" />
        </div>
      )}

      {summary.isError && <AiErrorNote className="mt-3 sm:pl-11" error={summary.error} onRetry={() => summary.mutate()} />}

      {hasResult && open && (
        <div id={regionId} className="mt-3 sm:pl-11">
          <p className="max-w-[70ch] text-[0.9375rem] leading-relaxed text-ink">{summary.data.summary}</p>
          {summary.data.includesInternalNotes && (
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[0.8125rem] text-warm-ink">
              <LockSimple aria-hidden weight="bold" className="size-3.5" />
              {t("internal")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

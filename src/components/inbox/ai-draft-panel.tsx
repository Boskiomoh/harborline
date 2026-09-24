"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowClockwise, BookmarkSimple, Stop, Ticket, TextAlignLeft } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import type { AiSource } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import { useDraftReplyMutation } from "@/lib/queries/ai";
import { AiErrorNote, AiMark } from "./ai-shared";

/**
 * "Draft with AI" (docs/AI-ASSIST.md step L). Streams a suggested reply built from similar solved
 * tickets and saved replies, lists what it drew on, and hands the text to the reply box below.
 * It never sends anything: the only way a draft reaches a customer is the agent's own Send.
 */
export function AiDraftPanel({ ticketId, composerText, onInsert }: { ticketId: number; composerText: string; onInsert: (text: string) => void }) {
  const t = useTranslations("inbox.ai.draft");
  const toast = useToast();
  const draftMutation = useDraftReplyMutation(ticketId);
  const { draft } = draftMutation;
  const [edited, setEdited] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"replace" | "redraft" | null>(null);

  const streaming = draftMutation.isPending;
  const done = draftMutation.isSuccess;
  const text = edited ?? draft.text;
  const active = streaming || done || draftMutation.isError;

  const start = () => {
    setEdited(null);
    draftMutation.mutate();
  };

  const insert = () => {
    onInsert(text.trim());
    draftMutation.reset();
    setEdited(null);
    toast({ title: t("inserted"), description: t("insertedBody") });
  };

  return (
    <section aria-labelledby="ai-draft-title" className="mt-8 rounded-[8px] border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <AiMark />
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="ai-draft-title" className="text-sm font-semibold text-ink">
            {t("title")}
          </h2>
          {!active && <p className="mt-0.5 max-w-[60ch] text-[0.8125rem] leading-snug text-ink-soft">{t("intro")}</p>}
          {streaming && (
            <p className="mt-0.5 text-[0.8125rem] text-ink-soft" role="status">
              {t("writing")}
            </p>
          )}
        </div>
        {!active && (
          <button type="button" onClick={start} className={buttonClass({ variant: "secondary", size: "sm", className: "max-sm:ml-11" })}>
            <TextAlignLeft aria-hidden weight="bold" className="size-4" />
            {t("start")}
          </button>
        )}
        {streaming && (
          <button type="button" onClick={draftMutation.stop} className={buttonClass({ variant: "secondary", size: "sm", className: "max-sm:ml-11" })}>
            <Stop aria-hidden weight="fill" className="size-3.5" />
            {t("stop")}
          </button>
        )}
      </div>

      {draftMutation.isError && <AiErrorNote className="mt-3 sm:pl-11" error={draftMutation.error} onRetry={start} />}

      {(streaming || done) && (
        <div className="mt-4">
          {streaming ? (
            <div aria-busy="true" className="min-h-[7.5rem] rounded-[8px] border border-border bg-bg px-3.5 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink">
              {draft.text ? (
                <span className="stream-caret">{draft.text}</span>
              ) : (
                <div className="grid gap-2.5 pt-1">
                  <Skeleton className="h-3.5 w-[92%]" />
                  <Skeleton className="h-3.5 w-[84%]" />
                  <Skeleton className="h-3.5 w-[58%]" />
                </div>
              )}
            </div>
          ) : (
            <>
              <label htmlFor="ai-draft-text" className="sr-only">
                {t("editLabel")}
              </label>
              <textarea
                id="ai-draft-text"
                rows={5}
                value={text}
                onChange={(event) => setEdited(event.target.value)}
                className={cn(inputClass, "min-h-[7.5rem] resize-y bg-bg py-3 text-[0.9375rem] leading-relaxed")}
              />
            </>
          )}

          <SourceList sources={draft.sources} />

          {done && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!text.trim()}
                onClick={() => (composerText.trim() ? setConfirm("replace") : insert())}
                className={buttonClass({ size: "sm" })}
              >
                {t("insert")}
              </button>
              <button
                type="button"
                onClick={() => (edited !== null && edited !== draft.text ? setConfirm("redraft") : start())}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                <ArrowClockwise aria-hidden weight="bold" className="size-4" />
                {t("again")}
              </button>
              <button
                type="button"
                onClick={() => {
                  draftMutation.reset();
                  setEdited(null);
                }}
                className={buttonClass({ variant: "ghost", size: "sm", className: "ml-auto" })}
              >
                {t("discard")}
              </button>
              {!text.trim() && <p className="basis-full text-[0.8125rem] text-ink-soft">{t("empty")}</p>}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirm === "replace"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          insert();
        }}
        tone="danger"
        icon={TextAlignLeft}
        title={t("replaceTitle")}
        description={t("replaceBody")}
        confirmLabel={t("replaceConfirm")}
      />
      <ConfirmDialog
        open={confirm === "redraft"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          start();
        }}
        tone="danger"
        icon={ArrowClockwise}
        title={t("redraftTitle")}
        description={t("redraftBody")}
        confirmLabel={t("redraftConfirm")}
      />
    </section>
  );
}

function SourceList({ sources }: { sources: AiSource[] | null }) {
  const t = useTranslations("inbox.ai.draft");
  if (sources === null) return null;
  if (sources.length === 0) return <p className="mt-3 text-[0.8125rem] leading-snug text-ink-soft">{t("noSources")}</p>;

  // Two replies from the same solved ticket read as one source to the agent.
  const unique = sources.filter(
    (s, i) => sources.findIndex((o) => o.kind === s.kind && (s.kind === "resolved_ticket" ? o.ticketId === s.ticketId : o.sourceId === s.sourceId)) === i,
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[0.8125rem] text-ink-soft">{t("basedOn")}</span>
      <ul className="contents">
        {unique.map((source) => {
          const label = source.kind === "resolved_ticket" ? t("sourceTicket", { id: source.ticketId ?? source.sourceId }) : (source.title ?? "");
          const Icon = source.kind === "resolved_ticket" ? Ticket : BookmarkSimple;
          return (
            <li
              key={source.id}
              title={t("sourceMatch", { percent: Math.round(source.similarity * 100) })}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 text-[0.8125rem] text-ink"
            >
              <Icon aria-hidden weight="bold" className="size-3.5 shrink-0 text-ink-soft" />
              <span className={cn("truncate", source.kind === "resolved_ticket" && "font-mono text-[0.75rem]")}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

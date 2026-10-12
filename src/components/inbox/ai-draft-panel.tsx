"use client";

import { buttonClass } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputClass } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/instance";
import type { AiSource } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import {
  ArrowClockwise,
  BookmarkSimple,
  Stop,
  TextAlignLeft,
  Ticket,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FC, useEffect, useRef, useState } from "react";
import AiErrorNote from "./ai-error-note";
import AiMark from "./ai-mark";

interface DraftState {
  text: string;
  sources: AiSource[] | null;
}

const emptyDraft: DraftState = { text: "", sources: null };

const SourceList: FC<{ sources: AiSource[] | null }> = ({ sources }) => {
  const t = useTranslations("inbox.ai.draft");

  if (sources === null) return null;

  if (sources.length === 0) {
    return (
      <p className="mt-3 text-[0.8125rem] leading-snug text-ink-soft">
        {t("noSources")}
      </p>
    );
  }

  // Two replies from the same solved ticket read as one source to the agent.
  const unique = sources.filter(
    (s, i) =>
      sources.findIndex(
        (o) =>
          o.kind === s.kind &&
          (s.kind === "resolved_ticket"
            ? o.ticketId === s.ticketId
            : o.sourceId === s.sourceId),
      ) === i,
  );

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[0.8125rem] text-ink-soft">
        {t("basedOn")}
      </span>
      <ul className="contents">
        {unique.map((source) => {
          const label =
            source.kind === "resolved_ticket"
              ? t("sourceTicket", { id: source.ticketId ?? source.sourceId })
              : (source.title ?? "");
          const Icon =
            source.kind === "resolved_ticket" ? Ticket : BookmarkSimple;

          return (
            <li
              key={source.id}
              title={t("sourceMatch", {
                percent: Math.round(source.similarity * 100),
              })}
              className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 text-[0.8125rem] text-ink"
            >
              <Icon
                aria-hidden
                weight="bold"
                className="size-3.5 shrink-0 text-ink-soft"
              />
              <span
                className={cn(
                  "truncate",
                  source.kind === "resolved_ticket" &&
                    "font-mono text-[0.75rem]",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface AiDraftPanelProps {
  ticketId: number;
  composerText: string;
  onInsert: (text: string) => void;
}

// "Draft with AI" (docs/AI-ASSIST.md step L). Streams a suggested reply and
// hands the text to the reply box below. It never sends anything: the only way
// a draft reaches a customer is the agent's own Send.
const AiDraftPanel: FC<AiDraftPanelProps> = ({
  ticketId,
  composerText,
  onInsert,
}) => {
  const t = useTranslations("inbox.ai.draft");
  const toast = useToast();

  // State
  const [draft, setDraft] = useState<DraftState>(emptyDraft);
  const [edited, setEdited] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"replace" | "redraft" | null>(null);

  // Ref
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Mutations
  const {
    mutate: draftReplyMutate,
    reset: draftReplyReset,
    isPending: draftReplyPending,
    isSuccess: draftReplySuccess,
    error: draftReplyError,
  } = useMutation({
    mutationKey: ["draft-reply", ticketId],
    // The route streams `text/plain`: one JSON line with the sources, a
    // newline, then the draft text as it's generated.
    mutationFn: async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setDraft(emptyDraft);

      const response = await fetch(`/api/tickets/${ticketId}/ai/draft`, {
        method: "POST",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new ApiError(response.status, await response.json());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sources: AiSource[] | null = null;
      let text = "";

      try {
        while (true) {
          const { value, done } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          if (sources === null) {
            buffer += chunk;
            const newline = buffer.indexOf("\n");

            if (newline === -1) continue;

            sources = JSON.parse(buffer.slice(0, newline)).sources;
            text = buffer.slice(newline + 1);
          } else {
            text += chunk;
          }

          setDraft({ text, sources });
        }
      } catch (error) {
        // Stopped by the agent: keep what arrived rather than treating it as a failure.
        if (controller.signal.aborted) return;

        throw error;
      }

      setDraft({ text: text.trim(), sources: sources ?? [] });
    },
  });

  // Derived
  const text = edited ?? draft.text;
  const active = draftReplyPending || draftReplySuccess || !!draftReplyError;

  // Handlers
  const handleStart = () => {
    setEdited(null);
    draftReplyMutate();
  };

  const handleStop = () => abortRef.current?.abort();

  const handleReset = () => {
    abortRef.current?.abort();
    setDraft(emptyDraft);
    setEdited(null);
    draftReplyReset();
  };

  const handleInsert = () => {
    onInsert(text.trim());
    handleReset();
    toast({ title: t("inserted"), description: t("insertedBody") });
  };

  return (
    <section
      aria-labelledby="ai-draft-title"
      className="mt-8 rounded-[8px] border border-border bg-surface p-4 shadow-soft sm:p-5"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <AiMark />
        <div className="min-w-0 flex-1 basis-56">
          <h2 id="ai-draft-title" className="text-sm font-semibold text-ink">
            {t("title")}
          </h2>
          {!active && (
            <p className="mt-0.5 max-w-[60ch] text-[0.8125rem] leading-snug text-ink-soft">
              {t("intro")}
            </p>
          )}
          {draftReplyPending && (
            <p className="mt-0.5 text-[0.8125rem] text-ink-soft" role="status">
              {t("writing")}
            </p>
          )}
        </div>
        {!active && (
          <button
            type="button"
            onClick={handleStart}
            className={buttonClass({
              variant: "secondary",
              size: "sm",
              className: "max-sm:ml-11",
            })}
          >
            <TextAlignLeft aria-hidden weight="bold" className="size-4" />
            {t("start")}
          </button>
        )}
        {draftReplyPending && (
          <button
            type="button"
            onClick={handleStop}
            className={buttonClass({
              variant: "secondary",
              size: "sm",
              className: "max-sm:ml-11",
            })}
          >
            <Stop aria-hidden weight="fill" className="size-3.5" />
            {t("stop")}
          </button>
        )}
      </div>

      {draftReplyError && (
        <AiErrorNote
          className="mt-3 sm:pl-11"
          error={draftReplyError}
          onRetry={handleStart}
        />
      )}

      {(draftReplyPending || draftReplySuccess) && (
        <div className="mt-4">
          {draftReplyPending ? (
            <div
              aria-busy="true"
              className="min-h-[7.5rem] rounded-[8px] border border-border bg-bg px-3.5 py-3 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-ink"
            >
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
                className={cn(
                  inputClass,
                  "min-h-[7.5rem] resize-y bg-bg py-3 text-[0.9375rem] leading-relaxed",
                )}
              />
            </>
          )}

          <SourceList sources={draft.sources} />

          {draftReplySuccess && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!text.trim()}
                onClick={() =>
                  composerText.trim() ? setConfirm("replace") : handleInsert()
                }
                className={buttonClass({ size: "sm" })}
              >
                {t("insert")}
              </button>
              <button
                type="button"
                onClick={() =>
                  edited !== null && edited !== draft.text
                    ? setConfirm("redraft")
                    : handleStart()
                }
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                <ArrowClockwise aria-hidden weight="bold" className="size-4" />
                {t("again")}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className={buttonClass({
                  variant: "ghost",
                  size: "sm",
                  className: "ml-auto",
                })}
              >
                {t("discard")}
              </button>
              {!text.trim() && (
                <p className="basis-full text-[0.8125rem] text-ink-soft">
                  {t("empty")}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Replace Composer Text Dialog */}
      <ConfirmDialog
        open={confirm === "replace"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          handleInsert();
        }}
        tone="danger"
        icon={TextAlignLeft}
        title={t("replaceTitle")}
        description={t("replaceBody")}
        confirmLabel={t("replaceConfirm")}
      />

      {/* Redraft Dialog */}
      <ConfirmDialog
        open={confirm === "redraft"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          handleStart();
        }}
        tone="danger"
        icon={ArrowClockwise}
        title={t("redraftTitle")}
        description={t("redraftBody")}
        confirmLabel={t("redraftConfirm")}
      />
    </section>
  );
};

export default AiDraftPanel;

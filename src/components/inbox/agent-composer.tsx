"use client";

import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toaster";
import { useSingleTicket } from "@/hooks/use-app-hooks/use-tickets";
import { apiInstance } from "@/lib/api/instance";
import type { PostMessageInput } from "@/lib/api/schemas";
import { cn } from "@/lib/cn";
import type { CannedResponse } from "@/lib/inbox";
import type { Enums } from "@/lib/supabase/database.types";
import type { Person } from "@/lib/tickets";
import {
  CaretDown,
  ChatCircleText,
  LockSimple,
  PaperPlaneRight,
  SpinnerGap,
} from "@phosphor-icons/react/dist/ssr";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FC, useEffect, useRef, useState } from "react";
import AiDraftPanel from "./ai-draft-panel";
import { useInbox } from "./inbox-provider";

type Status = Enums<"ticket_status">;

interface CannedPickerProps {
  items: CannedResponse[];
  staff: Person[];
  onPick: (body: string) => void;
}

const CannedPicker: FC<CannedPickerProps> = ({ items, staff, onPick }) => {
  const t = useTranslations("inbox.composer");

  // State
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Ref
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Derived
  const names = Object.fromEntries(staff.map((s) => [s.id, s.fullName]));
  const q = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q),
  );

  useEffect(() => {
    if (!open) return;

    searchRef.current?.focus();

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        <div
          id="canned-panel"
          className="absolute top-full right-0 z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-[8px] border border-border bg-surface p-2 shadow-float"
        >
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
            <p className="px-3 py-4 text-sm text-ink-soft">
              {t("cannedEmpty")}
            </p>
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
                      <span className="text-sm font-semibold text-ink">
                        {item.title}
                      </span>
                      {names[item.agent_id] && (
                        <span className="shrink-0 text-[0.6875rem] text-ink-soft">
                          {t("cannedBy", { name: names[item.agent_id] })}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-ink-soft">
                      {item.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

interface AgentComposerProps {
  ticketId: number;
  customerName: string;
  canned: CannedResponse[];
  staff: Person[];
}

const AgentComposer: FC<AgentComposerProps> = ({
  ticketId,
  customerName,
  canned,
  staff,
}) => {
  const t = useTranslations();
  const toast = useToast();

  // Stores
  const { inboxTicketsRefetch } = useInbox();

  // State
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [thenStatus, setThenStatus] = useState<"" | Status>("");
  const [error, setError] = useState<string | null>(null);

  // Ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const { refetch: ticketRefetch } = useSingleTicket(ticketId);

  // Derived
  const firstName = customerName.split(" ")[0] ?? "";
  const note = mode === "note";

  // Mutations
  const { mutate: postMessageMutate, isPending: postMessagePending } =
    useMutation({
      mutationKey: ["post-message", ticketId],
      mutationFn: async (input: PostMessageInput) => {
        try {
          const res = await apiInstance.post(
            `/api/tickets/${ticketId}/messages`,
            input,
          );

          return res.data;
        } catch (error) {
          throw error;
        }
      },
      onSuccess: async (_, input) => {
        await ticketRefetch();
        inboxTicketsRefetch();
        setBody("");
        setThenStatus("");
        toast({
          title: input.internal
            ? t("inbox.toast.noteAdded")
            : t("inbox.toast.replySent", { name: firstName || customerName }),
          description: input.setStatus
            ? t("inbox.toast.statusChanged", {
                status: t(`status.${input.setStatus}`),
              })
            : undefined,
        });
      },
      onError: () => setError(t("inbox.composer.errors.generic")),
    });

  // Handlers
  const handleSend = () => {
    if (!body.trim()) {
      setError(t("inbox.composer.errors.empty"));
      return;
    }

    setError(null);
    postMessageMutate({
      body,
      internal: note,
      ...(!note && thenStatus && { setStatus: thenStatus }),
    });
  };

  return (
    <>
      <AiDraftPanel
        ticketId={ticketId}
        composerText={body}
        onInsert={(text) => {
          setMode("reply");
          setBody(text);
          setError(null);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
        className={cn(
          "mt-3 rounded-[8px] border p-4 transition-colors sm:p-5",
          note
            ? "border-dashed border-warm/45 bg-warm-soft/60"
            : "border-border bg-surface shadow-raised",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="radiogroup"
            aria-label={t("inbox.composer.modeLabel")}
            className="inline-flex rounded-full border border-border bg-bg p-0.5"
          >
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
                    checked
                      ? value === "note"
                        ? "bg-warm-soft font-semibold text-warm-ink"
                        : "bg-surface font-semibold text-ink shadow-soft"
                      : "text-ink-soft hover:text-ink",
                  )}
                >
                  {value === "note" ? (
                    <LockSimple
                      aria-hidden
                      weight="bold"
                      className="size-3.5"
                    />
                  ) : (
                    <PaperPlaneRight
                      aria-hidden
                      weight="bold"
                      className="size-3.5"
                    />
                  )}
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
                setBody((current) =>
                  (current.trim()
                    ? `${current.trimEnd()}\n\n${text}`
                    : text
                  ).replaceAll("{first_name}", firstName),
                );
                textareaRef.current?.focus();
              }}
            />
          )}
        </div>

        <label
          htmlFor="composer"
          className="mt-4 block text-sm font-semibold text-ink"
        >
          {note
            ? t("inbox.composer.noteLabel")
            : t("inbox.composer.replyLabel", { name: customerName })}
        </label>
        {note && (
          <p className="mt-0.5 text-[0.8125rem] text-warm-ink">
            {t("inbox.composer.noteHint")}
          </p>
        )}
        <textarea
          ref={textareaRef}
          id="composer"
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handleSend();
            }
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "composer-error" : "composer-shortcut"}
          className={cn(
            inputClass,
            "mt-2 resize-y py-3 leading-relaxed",
            note && "border-warm/40 focus:border-warm focus:ring-warm/15",
          )}
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {error ? (
            <p
              id="composer-error"
              role="alert"
              className="text-[0.8125rem] font-medium text-danger"
            >
              {error}
            </p>
          ) : (
            <p
              id="composer-shortcut"
              className="hidden text-xs text-ink-soft sm:block"
            >
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
                    onChange={(event) =>
                      setThenStatus(event.target.value as "" | Status)
                    }
                    className="h-10 appearance-none rounded-full border border-border bg-surface pr-8 pl-3.5 text-sm text-ink hover:border-ink-faint"
                  >
                    <option value="">{t("inbox.composer.keepStatus")}</option>
                    <option value="waiting_on_customer">
                      {t("status.waiting_on_customer")}
                    </option>
                    <option value="resolved">{t("status.resolved")}</option>
                  </select>
                  <CaretDown
                    aria-hidden
                    weight="bold"
                    className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-ink-soft"
                  />
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={postMessagePending}
              aria-busy={postMessagePending || undefined}
              className={cn(
                buttonClass(),
                note && "bg-warm-ink hover:bg-warm-ink/90",
              )}
            >
              {postMessagePending ? (
                <SpinnerGap
                  aria-hidden
                  weight="bold"
                  className="size-4 motion-safe:animate-spin"
                />
              ) : note ? (
                <LockSimple aria-hidden weight="bold" className="size-4" />
              ) : (
                <PaperPlaneRight aria-hidden weight="bold" className="size-4" />
              )}
              {postMessagePending
                ? t("inbox.composer.sending")
                : note
                  ? t("inbox.composer.addNote")
                  : t("inbox.composer.send")}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

export default AgentComposer;

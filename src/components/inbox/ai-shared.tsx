"use client";

import { useTranslations } from "next-intl";
import { ArrowClockwise, Info, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/** The one mark every AI Assist surface carries, so agents learn to spot machine-written text. */
export function AiMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink", className)}>
      <Sparkle weight="fill" className="size-4" />
    </span>
  );
}

export function aiErrorKind(error: unknown): "unavailable" | "rateLimited" | "generic" {
  if (error instanceof ApiError) {
    if (error.status === 503) return "unavailable";
    if (error.status === 429) return "rateLimited";
  }
  return "generic";
}

/**
 * The calm failure state for AI Assist (docs/AI-ASSIST.md step P): a quiet note, never an error
 * boundary. The inbox keeps working around it; only a generic failure offers a retry.
 */
export function AiErrorNote({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const t = useTranslations("inbox.ai.errors");
  const kind = aiErrorKind(error);

  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] leading-snug text-ink-soft", className)}>
      <span className="inline-flex min-w-0 items-start gap-2">
        <Info aria-hidden weight="bold" className="mt-px size-4 shrink-0" />
        <span>{t(kind)}</span>
      </span>
      {onRetry && kind !== "rateLimited" && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium text-accent-ink underline-offset-4 hover:underline"
        >
          <ArrowClockwise aria-hidden weight="bold" className="size-3.5" />
          {t("retry")}
        </button>
      )}
    </div>
  );
}

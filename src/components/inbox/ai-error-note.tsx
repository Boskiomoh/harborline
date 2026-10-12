"use client";

import { ApiError } from "@/lib/api/instance";
import { cn } from "@/lib/cn";
import { ArrowClockwise, Info } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC } from "react";

interface AiErrorNoteProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

// The calm failure state for AI Assist (docs/AI-ASSIST.md step P): a quiet
// note, never an error boundary. Only a generic failure offers a retry.
const AiErrorNote: FC<AiErrorNoteProps> = ({ error, onRetry, className }) => {
  const t = useTranslations("inbox.ai.errors");

  // Derived
  const kind =
    error instanceof ApiError && error.status === 503
      ? "unavailable"
      : error instanceof ApiError && error.status === 429
        ? "rateLimited"
        : "generic";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.8125rem] leading-snug text-ink-soft",
        className,
      )}
    >
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
};

export default AiErrorNote;

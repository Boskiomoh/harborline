"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  /** Shown on the confirm button while `pending`. */
  pendingLabel?: string;
  pending?: boolean;
  /** `danger` for actions that throw work away; the safe choice (Cancel) then gets initial focus. */
  tone?: "default" | "danger";
  icon?: React.ComponentType<{ className?: string; weight?: "bold" | "fill"; "aria-hidden"?: boolean }>;
};

/**
 * A confirmation step for actions that need a moment of assurance: signing out, resolving a
 * ticket, replacing text the agent already wrote. Built on the native <dialog> in modal mode, so
 * focus is trapped, the page behind is inert, and Escape cancels, with no focus-trap library.
 * Clicking the backdrop cancels too. While `pending`, it can't be dismissed.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel, pendingLabel, pending = false, tone = "default", icon: Icon }: Props) {
  const t = useTranslations("dialog");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  const danger = tone === "danger";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current && !pending) onClose();
      }}
      className="dialog-surface m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[8px] border border-border bg-surface p-0 text-ink shadow-float backdrop:bg-ink/35"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          {Icon && (
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", danger ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent-ink")}>
              <Icon aria-hidden weight="bold" className="size-[1.125rem]" />
            </span>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="font-display text-xl leading-snug font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h2>
            <div id={bodyId} className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              {description}
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-border bg-bg/60 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" autoFocus={danger} disabled={pending} onClick={onClose} className={buttonClass({ variant: "secondary" })}>
          {t("cancel")}
        </button>
        <button
          type="button"
          autoFocus={!danger}
          disabled={pending}
          aria-busy={pending || undefined}
          onClick={onConfirm}
          className={buttonClass({ variant: danger ? "danger" : "primary" })}
        >
          {pending && <SpinnerGap aria-hidden weight="bold" className="size-4 motion-safe:animate-spin" />}
          {pending && pendingLabel ? pendingLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

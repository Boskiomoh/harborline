"use client";

import { useTranslations } from "next-intl";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { buttonClass } from "./button";

export function ErrorState({ retry }: { retry: () => void }) {
  const t = useTranslations("states");

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-8">
      <div role="alert" className="rounded-[8px] border border-border bg-surface px-6 py-10 text-center shadow-raised sm:px-10">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-danger/8 text-danger">
          <WarningCircle aria-hidden weight="bold" className="size-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{t("errorTitle")}</h1>
        <p className="mx-auto mt-2 max-w-[44ch] leading-relaxed text-ink-soft">{t("errorBody")}</p>
        <button type="button" onClick={() => retry()} className={buttonClass({ className: "mt-6" })}>
          {t("retry")}
        </button>
      </div>
    </div>
  );
}

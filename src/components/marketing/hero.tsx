import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { PriorityLabel } from "@/components/ui/priority-label";
import { SlaBadge } from "@/components/ui/sla-badge";
import { ThreadMessage } from "@/components/tickets/thread-message";

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="mx-auto grid max-w-7xl gap-14 px-5 pt-8 pb-20 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-14 lg:pb-28">
      <div className="lg:col-span-6 lg:pr-4">
        <h1 className="font-display text-[2.875rem] leading-[1.02] font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_84] sm:text-6xl lg:text-[4.5rem]">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-ink-soft sm:text-xl">{t("body")}</p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/sign-in" className={buttonClass({ size: "lg" })}>
            {t("primary")}
          </Link>
          <a href="#how-it-works" className={buttonClass({ variant: "secondary", size: "lg" })}>
            {t("secondary")}
          </a>
        </div>
      </div>

      <div className="lg:col-span-6">
        <HeroPreview />
      </div>
    </section>
  );
}

function HeroPreview() {
  const t = useTranslations("landing.preview");

  return (
    <div className="relative mx-auto max-w-xl lg:mr-0">
      <div aria-hidden className="absolute inset-x-5 top-8 -bottom-4 rounded-[8px] border border-border bg-surface-alt sm:inset-x-9 sm:-bottom-5" />
      <figure
        aria-label={t("label")}
        className="rise relative overflow-hidden rounded-[8px] border border-border bg-surface shadow-float"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <span className="font-mono text-xs text-ink-soft">#1001</span>
          <StatusPill status="new" size="sm" />
          <PriorityLabel priority="urgent" />
          <SlaBadge className="ml-auto" targetMinutes={60} status="new" startedMinutesAgo={51.5} />
        </div>

        <div className="px-4 pt-4 pb-5 sm:px-5">
          <h2 className="font-display text-xl leading-snug font-semibold tracking-[-0.02em] text-ink">{t("subject")}</h2>
          <p className="mt-1 text-sm text-ink-soft">{t("assignedTo", { name: t("agentName") })}</p>

          <div className="mt-4 grid gap-3">
            <ThreadMessage authorName={t("customerName")} authorRole="customer" body={t("customerMessage")} time={t("customerTime")} />
            <ThreadMessage authorName={t("agentName")} authorRole="agent" internal body={t("note")} time={t("noteTime")} />
          </div>

          <div className="mt-4 rounded-[8px] border border-accent/35 bg-surface p-3.5 ring-3 ring-accent/10">
            <p className="text-xs font-medium text-ink-soft">{t("draftLabel")}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">{t("draft")}</p>
            <div className="mt-3 flex justify-end">
              <span aria-hidden className={buttonClass({ size: "sm" })}>
                {t("send")}
              </span>
            </div>
          </div>
        </div>
      </figure>
    </div>
  );
}

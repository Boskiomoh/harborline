import ThreadMessage from "@/components/tickets/thread-message";
import { buttonClass } from "@/components/ui/button";
import { PriorityLabel } from "@/components/ui/priority-label";
import { SlaBadge } from "@/components/ui/sla-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { useTranslations } from "next-intl";
import { FC } from "react";

const HeroPreview: FC = () => {
  const t = useTranslations("landing.preview");

  return (
    <div className="relative mx-auto max-w-xl lg:mr-0">
      <div
        aria-hidden
        className="absolute inset-x-5 top-8 -bottom-4 rounded-[8px] border border-border bg-surface-alt sm:inset-x-9 sm:-bottom-5"
      />
      <figure
        aria-label={t("label")}
        className="rise relative overflow-hidden rounded-[8px] border border-border bg-surface shadow-float"
        style={{ animationDelay: "120ms" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <span className="font-mono text-xs text-ink-soft">#1001</span>
          <StatusPill status="new" size="sm" />
          <PriorityLabel priority="urgent" />
          <SlaBadge
            className="ml-auto"
            targetMinutes={60}
            status="new"
            startedMinutesAgo={51.5}
          />
        </div>

        <div className="px-4 pt-4 pb-5 sm:px-5">
          <h2 className="font-display text-xl leading-snug font-semibold tracking-[-0.02em] text-ink">
            {t("subject")}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t("assignedTo", { name: t("agentName") })}
          </p>

          <div className="mt-4 grid gap-3">
            <ThreadMessage
              authorName={t("customerName")}
              authorRole="customer"
              body={t("customerMessage")}
              time={t("customerTime")}
            />
            <ThreadMessage
              authorName={t("agentName")}
              authorRole="agent"
              internal
              body={t("note")}
              time={t("noteTime")}
            />
          </div>

          <div className="mt-4 rounded-[8px] border border-accent/35 bg-surface p-3.5 ring-3 ring-accent/10">
            <p className="text-xs font-medium text-ink-soft">
              {t("draftLabel")}
            </p>
            <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">
              {t("draft")}
            </p>
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
};

export default HeroPreview;

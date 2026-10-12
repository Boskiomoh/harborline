import ThreadMessage from "@/components/tickets/thread-message";
import { SlaBadge } from "@/components/ui/sla-badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Eye, Headset } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC } from "react";

const example = {
  createdAt: "2026-08-02T09:00:00Z",
  firstResponseAt: "2026-08-02T09:38:00Z",
};

const names = { customer: "Maya Okafor", agent: "Tomás Reyes" };

const TwoViews: FC = () => {
  const t = useTranslations("landing.views");

  return (
    <section
      aria-labelledby="views-title"
      className="border-y border-border bg-surface-alt/45"
    >
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <h2
          id="views-title"
          className="max-w-[18ch] font-display text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-ink [font-variation-settings:'wdth'_84] sm:text-5xl"
        >
          {t("title")}
        </h2>
        <p className="mt-5 max-w-[60ch] text-lg leading-relaxed text-ink-soft">
          {t("body")}
        </p>

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-2">
          <div className="rounded-[8px] border border-border bg-bg p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2.5 pb-4">
              <Eye aria-hidden weight="bold" className="size-5 text-ink-soft" />
              <h3 className="text-sm font-semibold text-ink">
                {t("customer")}
              </h3>
              <StatusPill
                status="resolved"
                audience="customer"
                size="sm"
                className="ml-auto"
              />
            </div>
            <div className="grid gap-3">
              <ThreadMessage
                authorName={names.customer}
                authorRole="customer"
                isViewer
                body={t("customerMessage")}
                time={t("customerTime")}
              />
              <ThreadMessage
                authorName={names.agent}
                authorRole="agent"
                body={t("agentReply")}
                time={t("replyTime")}
              />
            </div>
          </div>

          <div className="rounded-[8px] border border-border bg-surface p-4 shadow-raised sm:p-5">
            <div className="flex flex-wrap items-center gap-2.5 pb-4">
              <Headset
                aria-hidden
                weight="bold"
                className="size-5 text-accent-ink"
              />
              <h3 className="text-sm font-semibold text-ink">{t("agent")}</h3>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <SlaBadge
                  size="sm"
                  targetMinutes={60}
                  status="resolved"
                  {...example}
                />
                <StatusPill status="resolved" size="sm" />
              </div>
            </div>
            <div className="grid gap-3">
              <ThreadMessage
                authorName={names.customer}
                authorRole="customer"
                body={t("customerMessage")}
                time={t("customerTime")}
              />
              <ThreadMessage
                authorName={names.agent}
                authorRole="agent"
                internal
                body={t("note")}
                time={t("replyTime")}
              />
              <ThreadMessage
                authorName={names.agent}
                authorRole="agent"
                isViewer
                body={t("agentReply")}
                time={t("replyTime")}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TwoViews;

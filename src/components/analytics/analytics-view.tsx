"use client";

import CategoryChart from "@/components/analytics/category-chart";
import StatusChart from "@/components/analytics/status-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnalytics } from "@/hooks/use-app-hooks/use-analytics";
import type { AnalyticsData } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { durationParts } from "@/lib/sla";
import { CheckCircle, Timer, Warning } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC, type ReactNode } from "react";

interface StatTileProps {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "calm" | "warm";
}

const StatTile: FC<StatTileProps> = ({
  icon,
  label,
  value,
  hint,
  tone = "calm",
}) => (
  <div className="rounded-[8px] border border-border bg-surface p-5 shadow-soft sm:p-6">
    <p className="flex items-center gap-2 text-sm font-medium text-ink-soft">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full",
          tone === "warm"
            ? "bg-warm-soft text-warm-ink"
            : "bg-accent-soft text-accent-ink",
        )}
      >
        {icon}
      </span>
      {label}
    </p>
    <p className="mt-4 text-5xl leading-none font-semibold tracking-[-0.02em] text-ink">
      {value}
    </p>
    <p className="mt-3 text-sm text-ink-soft">{hint}</p>
  </div>
);

const AnalyticsView: FC = () => {
  const t = useTranslations();

  // Queries
  const { data: analyticsData } = useAnalytics(30);
  const data: AnalyticsData | undefined = analyticsData;

  // Handlers
  const minutes = (value: number | null) => {
    if (value === null) return t("analytics.noReplies");

    const { key, values } = durationParts(value * 60_000);

    return t(`duration.${key}`, values);
  };

  // Hydrated from the server prefetch; this never shows in practice.
  if (!data) return null;

  const breaches = data.lateResponses + data.overdueOpen;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12">
      <header>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_86]">
          {t("analytics.title")}
        </h1>
        <p className="mt-2 text-ink-soft">{t("analytics.body")}</p>
      </header>

      {data.totalTickets === 0 ? (
        <EmptyState
          className="mt-8"
          title={t("analytics.title")}
          body={t("analytics.empty")}
        />
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <StatTile
              icon={<Timer aria-hidden weight="bold" className="size-5" />}
              label={t("analytics.avgFirstResponse")}
              value={minutes(data.avgFirstResponseMinutes)}
              hint={t("analytics.avgFirstResponseHint", {
                count: data.respondedCount,
              })}
            />
            <StatTile
              icon={
                breaches > 0 ? (
                  <Warning aria-hidden weight="bold" className="size-5" />
                ) : (
                  <CheckCircle aria-hidden weight="bold" className="size-5" />
                )
              }
              tone={breaches > 0 ? "warm" : "calm"}
              label={t("analytics.breaches")}
              value={String(breaches)}
              hint={t("analytics.breachesHint", {
                late: data.lateResponses,
                overdue: data.overdueOpen,
              })}
            />
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <section
              aria-labelledby="status-chart-title"
              className="rounded-[8px] border border-border bg-surface p-5 shadow-soft sm:p-6 lg:col-span-3"
            >
              <h2
                id="status-chart-title"
                className="text-base font-semibold text-ink"
              >
                {t("analytics.statusTitle")}
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                {t("analytics.statusHint")}
              </p>
              <StatusChart data={data.statusDaily} />
            </section>

            <section
              aria-labelledby="category-chart-title"
              className="rounded-[8px] border border-border bg-surface p-5 shadow-soft sm:p-6 lg:col-span-2"
            >
              <h2
                id="category-chart-title"
                className="text-base font-semibold text-ink"
              >
                {t("analytics.categoryTitle")}
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                {t("analytics.categoryHint")}
              </p>
              <CategoryChart data={data.byCategory} />
            </section>
          </div>

          <section
            aria-labelledby="targets-title"
            className="mt-4 rounded-[8px] border border-border bg-surface shadow-soft"
          >
            <h2
              id="targets-title"
              className="px-5 pt-5 text-base font-semibold text-ink sm:px-6"
            >
              {t("analytics.targetsTitle")}
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="text-ink-soft">
                  <tr className="border-b border-border">
                    <th scope="col" className="px-5 py-2.5 font-medium sm:px-6">
                      {t("analytics.targetsPriority")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-right font-medium"
                    >
                      {t("analytics.targetsTarget")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-right font-medium"
                    >
                      {t("analytics.targetsAverage")}
                    </th>
                    <th
                      scope="col"
                      className="px-5 py-2.5 text-right font-medium sm:px-6"
                    >
                      {t("analytics.targetsBreaches")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.byPriority.map((row) => {
                    const over =
                      row.avg_minutes !== null &&
                      row.avg_minutes > row.target_minutes;

                    return (
                      <tr
                        key={row.priority}
                        className="border-b border-border last:border-0"
                      >
                        <th
                          scope="row"
                          className="px-5 py-3 font-semibold text-ink sm:px-6"
                        >
                          {t(`priority.${row.priority}`)}
                        </th>
                        <td className="px-5 py-3 text-right font-mono text-ink tabular-nums">
                          {minutes(row.target_minutes)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right font-mono tabular-nums",
                            over ? "font-semibold text-warm-ink" : "text-ink",
                          )}
                        >
                          {minutes(row.avg_minutes)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums sm:px-6">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5",
                              row.breaches > 0
                                ? "font-semibold text-warm-ink"
                                : "text-ink-soft",
                            )}
                          >
                            {row.breaches > 0 && (
                              <Warning
                                aria-hidden
                                weight="fill"
                                className="size-3.5"
                              />
                            )}
                            {row.breaches}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AnalyticsView;

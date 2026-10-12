"use client";

import type { StatusDay } from "@/lib/analytics";
import { CHART_CHROME, STATUS_CHART_COLORS } from "@/lib/chart-colors";
import { useFormatter, useTranslations } from "next-intl";
import { FC } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartLegend from "./chart-legend";
import ChartTooltipCard from "./chart-tooltip-card";

// Legend and tooltip order matches the visual stack (top to bottom).
const statusSeries = [
  { key: "new_count", status: "new" },
  { key: "in_progress_count", status: "in_progress" },
  { key: "waiting_count", status: "waiting_on_customer" },
  { key: "resolved_count", status: "resolved" },
] as const;

const tick = { fill: CHART_CHROME.tick, fontSize: 12 };

interface StatusChartProps {
  data: StatusDay[];
}

const StatusChart: FC<StatusChartProps> = ({ data }) => {
  const t = useTranslations();
  const format = useFormatter();

  // Handlers
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T00:00:00Z`), {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  return (
    <>
      <ChartLegend
        items={statusSeries.map((s) => ({
          label: t(`status.${s.status}`),
          color: STATUS_CHART_COLORS[s.key],
        }))}
      />
      <div
        role="img"
        aria-label={t("analytics.statusChartLabel")}
        className="mt-3 h-72"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis
              dataKey="day"
              tickFormatter={dayLabel}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: CHART_CHROME.axis }}
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={tick}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.tick, strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={dayLabel(String(label))}
                    rows={statusSeries.map((s) => ({
                      label: t(`status.${s.status}`),
                      value: Number(
                        payload.find((p) => p.dataKey === s.key)?.value ?? 0,
                      ),
                      color: STATUS_CHART_COLORS[s.key],
                    }))}
                  />
                ) : null
              }
            />
            {/* Rendered bottom-up; a 2px surface stroke separates the bands. */}
            {[...statusSeries].reverse().map((s) => (
              <Area
                key={s.key}
                type="linear"
                dataKey={s.key}
                stackId="status"
                stroke={CHART_CHROME.surface}
                strokeWidth={2}
                fill={STATUS_CHART_COLORS[s.key]}
                fillOpacity={0.9}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          {t("analytics.viewTable")}
        </summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-[8px] border border-border">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="sticky top-0 bg-surface text-ink-soft">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("analytics.day")}
                </th>
                {statusSeries.map((s) => (
                  <th
                    key={s.key}
                    scope="col"
                    className="px-3 py-2 text-right font-medium"
                  >
                    {t(`status.${s.status}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row) => (
                <tr
                  key={row.day}
                  className="border-b border-border last:border-0"
                >
                  <th scope="row" className="px-3 py-1.5 font-medium text-ink">
                    {dayLabel(row.day)}
                  </th>
                  {statusSeries.map((s) => (
                    <td
                      key={s.key}
                      className="px-3 py-1.5 text-right font-mono text-ink tabular-nums"
                    >
                      {row[s.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
};

export default StatusChart;

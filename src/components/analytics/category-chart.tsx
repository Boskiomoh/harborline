"use client";

import type { CategoryRow } from "@/lib/analytics";
import { CATEGORY_CHART_COLORS, CHART_CHROME } from "@/lib/chart-colors";
import { useTranslations } from "next-intl";
import { FC } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ChartLegend from "./chart-legend";
import ChartTooltipCard from "./chart-tooltip-card";

const tick = { fill: CHART_CHROME.tick, fontSize: 12 };

interface CategoryChartProps {
  data: CategoryRow[];
}

const CategoryChart: FC<CategoryChartProps> = ({ data }) => {
  const t = useTranslations();

  // Derived
  const rows = data.map((row) => ({
    ...row,
    label: t(`category.${row.category}`),
  }));
  const series = [
    { key: "open_count", label: t("analytics.open") },
    { key: "resolved_count", label: t("analytics.resolved") },
  ] as const;

  return (
    <>
      <ChartLegend
        items={series.map((s) => ({
          label: s.label,
          color: CATEGORY_CHART_COLORS[s.key],
        }))}
      />
      <div
        role="img"
        aria-label={t("analytics.categoryChartLabel")}
        className="mt-3 h-72"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={tick}
              tickLine={false}
              axisLine={{ stroke: CHART_CHROME.axis }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={tick}
              tickLine={false}
              axisLine={false}
              width={124}
            />
            <Tooltip
              cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={String(label)}
                    rows={series.map((s) => ({
                      label: s.label,
                      value: Number(
                        payload.find((p) => p.dataKey === s.key)?.value ?? 0,
                      ),
                      color: CATEGORY_CHART_COLORS[s.key],
                    }))}
                  />
                ) : null
              }
            />
            <Bar
              dataKey="open_count"
              stackId="c"
              fill={CATEGORY_CHART_COLORS.open_count}
              stroke={CHART_CHROME.surface}
              strokeWidth={2}
              maxBarSize={22}
              isAnimationActive={false}
            />
            <Bar
              dataKey="resolved_count"
              stackId="c"
              fill={CATEGORY_CHART_COLORS.resolved_count}
              stroke={CHART_CHROME.surface}
              strokeWidth={2}
              radius={[0, 4, 4, 0]}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          {t("analytics.viewTable")}
        </summary>
        <div className="mt-3 overflow-auto rounded-[8px] border border-border">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="text-ink-soft">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium">
                  {t("analytics.categoryColumn")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("analytics.open")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("analytics.resolved")}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t("analytics.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.category}
                  className="border-b border-border last:border-0"
                >
                  <th scope="row" className="px-3 py-1.5 font-medium text-ink">
                    {row.label}
                  </th>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {row.open_count}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {row.resolved_count}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {row.open_count + row.resolved_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
};

export default CategoryChart;

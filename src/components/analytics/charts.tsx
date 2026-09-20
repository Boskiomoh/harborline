"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryRow, StatusDay } from "@/lib/analytics";
import { CATEGORY_CHART_COLORS, CHART_CHROME, STATUS_CHART_COLORS } from "@/lib/chart-colors";

// Legend and tooltip order matches the visual stack (top to bottom).
const STATUS_SERIES = [
  { key: "new_count", status: "new" },
  { key: "in_progress_count", status: "in_progress" },
  { key: "waiting_count", status: "waiting_on_customer" },
  { key: "resolved_count", status: "resolved" },
] as const;

const tick = { fill: CHART_CHROME.tick, fontSize: 12 };

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  const t = useTranslations("analytics");
  return (
    <ul aria-label={t("legend")} className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-soft">
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function TooltipCard({ title, rows }: { title: string; rows: Array<{ label: string; value: number; color: string }> }) {
  return (
    <div className="min-w-44 rounded-[8px] border border-border bg-surface px-3 py-2.5 text-[0.8125rem] shadow-float">
      <p className="font-semibold text-ink">{title}</p>
      <ul className="mt-1.5 grid gap-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-ink-soft">
            <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: row.color }} />
            <span className="flex-1">{row.label}</span>
            <span className="font-mono text-ink tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusChart({ data }: { data: StatusDay[] }) {
  const t = useTranslations();
  const format = useFormatter();
  const dayLabel = (day: string) => format.dateTime(new Date(`${day}T00:00:00Z`), { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <>
      <Legend items={STATUS_SERIES.map((s) => ({ label: t(`status.${s.status}`), color: STATUS_CHART_COLORS[s.key] }))} />
      <div role="img" aria-label={t("analytics.statusChartLabel")} className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={CHART_CHROME.grid} />
            <XAxis dataKey="day" tickFormatter={dayLabel} tick={tick} tickLine={false} axisLine={{ stroke: CHART_CHROME.axis }} minTickGap={28} />
            <YAxis allowDecimals={false} tick={tick} tickLine={false} axisLine={false} width={40} />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.tick, strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={dayLabel(String(label))}
                    rows={STATUS_SERIES.map((s) => ({
                      label: t(`status.${s.status}`),
                      value: Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                      color: STATUS_CHART_COLORS[s.key],
                    }))}
                  />
                ) : null
              }
            />
            {/* Rendered bottom-up; a 2px surface stroke separates the bands. */}
            {[...STATUS_SERIES].reverse().map((s) => (
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
        <summary className="cursor-pointer text-sm font-medium text-accent-ink underline-offset-4 hover:underline">{t("analytics.viewTable")}</summary>
        <div className="mt-3 max-h-64 overflow-auto rounded-[8px] border border-border">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="sticky top-0 bg-surface text-ink-soft">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium">{t("analytics.day")}</th>
                {STATUS_SERIES.map((s) => (
                  <th key={s.key} scope="col" className="px-3 py-2 text-right font-medium">
                    {t(`status.${s.status}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row) => (
                <tr key={row.day} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-1.5 font-medium text-ink">{dayLabel(row.day)}</th>
                  {STATUS_SERIES.map((s) => (
                    <td key={s.key} className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
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
}

export function CategoryChart({ data }: { data: CategoryRow[] }) {
  const t = useTranslations();
  const rows = data.map((row) => ({ ...row, label: t(`category.${row.category}`) }));
  const series = [
    { key: "open_count", label: t("analytics.open") },
    { key: "resolved_count", label: t("analytics.resolved") },
  ] as const;

  return (
    <>
      <Legend items={series.map((s) => ({ label: s.label, color: CATEGORY_CHART_COLORS[s.key] }))} />
      <div role="img" aria-label={t("analytics.categoryChartLabel")} className="mt-3 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid horizontal={false} stroke={CHART_CHROME.grid} />
            <XAxis type="number" allowDecimals={false} tick={tick} tickLine={false} axisLine={{ stroke: CHART_CHROME.axis }} />
            <YAxis type="category" dataKey="label" tick={tick} tickLine={false} axisLine={false} width={124} />
            <Tooltip
              cursor={{ fill: CHART_CHROME.grid, fillOpacity: 0.5 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={String(label)}
                    rows={series.map((s) => ({
                      label: s.label,
                      value: Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0),
                      color: CATEGORY_CHART_COLORS[s.key],
                    }))}
                  />
                ) : null
              }
            />
            <Bar dataKey="open_count" stackId="c" fill={CATEGORY_CHART_COLORS.open_count} stroke={CHART_CHROME.surface} strokeWidth={2} maxBarSize={22} isAnimationActive={false} />
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
        <summary className="cursor-pointer text-sm font-medium text-accent-ink underline-offset-4 hover:underline">{t("analytics.viewTable")}</summary>
        <div className="mt-3 overflow-auto rounded-[8px] border border-border">
          <table className="w-full text-left text-[0.8125rem]">
            <thead className="text-ink-soft">
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium">{t("analytics.categoryColumn")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("analytics.open")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("analytics.resolved")}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{t("analytics.total")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-1.5 font-medium text-ink">{row.label}</th>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">{row.open_count}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">{row.resolved_count}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">{row.open_count + row.resolved_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

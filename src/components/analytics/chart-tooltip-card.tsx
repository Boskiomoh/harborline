import { FC } from "react";

interface ChartTooltipCardProps {
  title: string;
  rows: Array<{ label: string; value: number; color: string }>;
}

const ChartTooltipCard: FC<ChartTooltipCardProps> = ({ title, rows }) => (
  <div className="min-w-44 rounded-[8px] border border-border bg-surface px-3 py-2.5 text-[0.8125rem] shadow-float">
    <p className="font-semibold text-ink">{title}</p>
    <ul className="mt-1.5 grid gap-1">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2 text-ink-soft">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span className="flex-1">{row.label}</span>
          <span className="font-mono text-ink tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default ChartTooltipCard;

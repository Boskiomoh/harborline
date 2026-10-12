"use client";

import { useTranslations } from "next-intl";
import { FC } from "react";

interface ChartLegendProps {
  items: Array<{ label: string; color: string }>;
}

const ChartLegend: FC<ChartLegendProps> = ({ items }) => {
  const t = useTranslations("analytics");

  return (
    <ul
      aria-label={t("legend")}
      className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-ink-soft"
    >
      {items.map((item) => (
        <li key={item.label} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
};

export default ChartLegend;

import { useTranslations } from "next-intl";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { StatusPill } from "@/components/ui/status-pill";
import { SlaBadge } from "@/components/ui/sla-badge";
import { cn } from "@/lib/cn";

// A fixed, past ticket: the badge only needs the two timestamps, not the current time.
const RESOLVED_EXAMPLE = { createdAt: "2026-08-02T09:00:00Z", firstResponseAt: "2026-08-02T09:38:00Z" };

export function HowItWorks() {
  const t = useTranslations("landing.how");

  const steps = [
    {
      key: "submit",
      marker: "border-border bg-surface text-ink",
      fragment: (
        <div className="max-w-64">
          <div aria-hidden className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1.5 rounded-full", i < 2 ? "bg-accent" : "bg-border")} />
            ))}
          </div>
          <p className="mt-2.5 text-sm font-medium text-ink">{t("submit.fragment")}</p>
        </div>
      ),
    },
    {
      key: "track",
      marker: "border-accent/25 bg-accent-soft text-accent-ink",
      fragment: (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status="new" size="sm" />
          <CaretRight aria-hidden weight="bold" className="size-3.5 text-ink-soft" />
          <StatusPill status="in_progress" size="sm" />
          <CaretRight aria-hidden weight="bold" className="size-3.5 text-ink-soft" />
          <StatusPill status="waiting_on_customer" audience="customer" size="sm" />
        </div>
      ),
    },
    {
      key: "resolve",
      marker: "border-accent bg-accent text-white",
      fragment: (
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status="resolved" size="sm" />
          <SlaBadge size="sm" targetMinutes={60} status="resolved" {...RESOLVED_EXAMPLE} />
        </div>
      ),
    },
  ] as const;

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6 border-t border-border">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <h2
          id="how-title"
          className="max-w-[16ch] font-display text-4xl leading-[1.05] font-semibold tracking-[-0.035em] text-ink [font-variation-settings:'wdth'_84] sm:text-5xl"
        >
          {t("title")}
        </h2>

        <ol className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step, index) => (
            <li key={step.key} className="relative flex gap-5 md:block">
              {/* Connector: vertical on mobile, horizontal from md up */}
              {index < steps.length - 1 && (
                <span aria-hidden className="absolute top-11 bottom-[-2.5rem] left-5 w-px bg-border md:top-5 md:right-0 md:bottom-auto md:left-14 md:h-px md:w-auto" />
              )}
              <span
                aria-hidden
                className={cn("relative z-10 grid size-10 shrink-0 place-items-center rounded-full border font-mono text-sm font-semibold", step.marker)}
              >
                {index + 1}
              </span>
              <div className="md:mt-6 md:pr-6">
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{t(`${step.key}.title`)}</h3>
                <p className="mt-2 max-w-[38ch] leading-relaxed text-ink-soft">{t(`${step.key}.body`)}</p>
                <div className="mt-6">{step.fragment}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

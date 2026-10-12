import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/roles";
import { LockSimple } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC, type ReactNode } from "react";

interface ThreadMessageProps {
  authorName: string;
  authorRole: Role;
  body: string;
  time: ReactNode;
  internal?: boolean;
  isViewer?: boolean;
  className?: string;
  children?: ReactNode;
}

const ThreadMessage: FC<ThreadMessageProps> = ({
  authorName,
  authorRole,
  body,
  time,
  internal = false,
  isViewer = false,
  className,
  children,
}) => {
  const t = useTranslations();

  // Derived
  const staff = authorRole !== "customer";

  return (
    <article
      className={cn(
        "relative grid grid-cols-[auto_1fr] gap-x-3 rounded-[8px] px-4 py-3.5",
        internal
          ? "border border-dashed border-warm/45 bg-warm-soft"
          : staff
            ? "border border-border bg-surface shadow-soft"
            : "border border-transparent bg-surface-alt/60",
        className,
      )}
    >
      <Avatar
        name={authorName}
        tone={staff ? "staff" : "customer"}
        size="sm"
        className="mt-0.5"
      />
      <div className="min-w-0">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-ink">
            {isViewer ? t("thread.you") : authorName}
          </span>
          {staff && !internal && (
            <span className="text-xs font-medium text-accent-ink">
              {t(`roles.${authorRole}`)}
            </span>
          )}
          {internal && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-warm-ink">
              <LockSimple aria-hidden weight="bold" className="size-3.5" />
              {t("thread.internalNote")}
            </span>
          )}
          <span className="ml-auto font-mono text-[0.6875rem] text-ink-soft">
            {time}
          </span>
        </header>
        <p className="mt-1 text-[0.9375rem] leading-relaxed text-pretty whitespace-pre-line text-ink">
          {body}
        </p>
        {internal && (
          <p className="mt-2 text-xs text-warm-ink">
            {t("thread.hiddenFromCustomer")}
          </p>
        )}
        {children}
      </div>
    </article>
  );
};

export default ThreadMessage;

"use client";

import { cn } from "@/lib/cn";
import {
  CheckCircle,
  Info,
  WarningCircle,
  X,
} from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import {
  createContext,
  FC,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "success" | "error" | "info";

interface ToastInput {
  tone?: Tone;
  title: string;
  description?: string;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: Tone;
}

const tones = {
  success: { Icon: CheckCircle, icon: "text-accent" },
  error: { Icon: WarningCircle, icon: "text-danger" },
  info: { Icon: Info, icon: "text-ink-soft" },
} as const;

// Errors stay longer: they usually mean the agent has to do something again.
const durations: Record<Tone, number> = {
  success: 4500,
  info: 4500,
  error: 7000,
};

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

// Toasts are only for transient news (a reply sent, a status changed);
// persistent problems stay inline next to the thing that failed.
const useToast = () => {
  const toast = useContext(ToastContext);

  if (!toast) throw new Error("useToast must be used inside <ToastProvider>");

  return toast;
};

interface ToastCardProps {
  item: ToastItem;
  onDismiss: (id: number) => void;
  closeLabel: string;
}

const ToastCard: FC<ToastCardProps> = ({ item, onDismiss, closeLabel }) => {
  // State
  const [paused, setPaused] = useState(false);

  // Derived
  const { Icon, icon } = tones[item.tone];

  useEffect(() => {
    if (paused) return;

    const timer = window.setTimeout(
      () => onDismiss(item.id),
      durations[item.tone],
    );

    return () => window.clearTimeout(timer);
  }, [paused, item.id, item.tone, onDismiss]);

  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="toast-enter pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[8px] border border-border bg-surface py-3 pr-2 pl-3.5 text-sm shadow-float"
    >
      <Icon
        aria-hidden
        weight="fill"
        className={cn("mt-0.5 size-[1.125rem] shrink-0", icon)}
      />
      <div className="min-w-0 flex-1 py-px">
        <p className="font-semibold text-ink">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">
            {item.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={closeLabel}
        className="grid size-7 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink"
      >
        <X aria-hidden weight="bold" className="size-3.5" />
      </button>
    </div>
  );
};

const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const t = useTranslations("toast");

  // State
  const [items, setItems] = useState<ToastItem[]>([]);

  // Ref
  const nextId = useRef(1);

  // Handlers
  const handleDismiss = (id: number) =>
    setItems((current) => current.filter((item) => item.id !== id));

  const toast = (input: ToastInput) => {
    const item: ToastItem = {
      ...input,
      tone: input.tone ?? "success",
      id: nextId.current++,
    };

    setItems((current) => [...current, item].slice(-3));
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <section
        aria-label={t("region")}
        aria-live="polite"
        // Top of the screen: the reply box and its Send button live bottom-right, and a toast must never cover them.
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-5"
      >
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            onDismiss={handleDismiss}
            closeLabel={t("close")}
          />
        ))}
      </section>
    </ToastContext.Provider>
  );
};

export { ToastProvider, useToast };

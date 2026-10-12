import { cn } from "@/lib/cn";
import { FC, type ReactNode } from "react";

export const inputClass =
  "block w-full rounded-[8px] border border-border bg-surface px-3.5 text-[0.9375rem] text-ink shadow-soft " +
  "placeholder:text-ink-soft/70 transition-[border-color,box-shadow] duration-150 " +
  "hover:border-ink-faint focus:border-accent focus:ring-3 focus:ring-accent/15 focus:outline-none " +
  "aria-invalid:border-danger aria-invalid:focus:ring-danger/15 disabled:bg-surface-alt disabled:text-ink-soft";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

const Field: FC<FieldProps> = ({
  id,
  label,
  hint,
  error,
  className,
  children,
}) => (
  <div className={cn("grid gap-1.5", className)}>
    <label htmlFor={id} className="text-sm font-medium text-ink">
      {label}
    </label>
    {children}
    {hint && !error && (
      <p id={`${id}-hint`} className="text-[0.8125rem] text-ink-soft">
        {hint}
      </p>
    )}
    {error && (
      <p
        id={`${id}-error`}
        className="text-[0.8125rem] font-medium text-danger"
      >
        {error}
      </p>
    )}
  </div>
);

export { Field };

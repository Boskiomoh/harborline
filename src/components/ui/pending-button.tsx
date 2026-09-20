"use client";

import { useFormStatus } from "react-dom";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string };

/** Submit button for server-action forms: disables itself and shows progress while the action runs. */
export function PendingButton({ children, pendingLabel, disabled, ...props }: Props) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" {...props} disabled={disabled || pending} aria-busy={pending || undefined}>
      {pending && <SpinnerGap aria-hidden weight="bold" className="size-4 animate-spin motion-reduce:animate-none" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

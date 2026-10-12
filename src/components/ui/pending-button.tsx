"use client";

import { SpinnerGap } from "@phosphor-icons/react/dist/ssr";
import { FC, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";

interface PendingButtonProps extends ComponentProps<"button"> {
  pendingLabel?: string;
}

// Submit button for server-action forms: disables itself while the action runs.
const PendingButton: FC<PendingButtonProps> = ({
  children,
  pendingLabel,
  disabled,
  ...props
}) => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      {...props}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && (
        <SpinnerGap
          aria-hidden
          weight="bold"
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
};

export { PendingButton };

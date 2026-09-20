"use client";

import { useTransition } from "react";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { signOut } from "@/lib/actions/auth";
import { clearBrowserQueryCache } from "@/lib/query/browser-client";

/**
 * Clears the TanStack Query cache (in-memory and the persisted sessionStorage copy) before
 * calling the sign-out server action, so nothing from this session — ticket text, customer
 * names — is still sitting in the browser once it completes.
 */
export function SignOutButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        clearBrowserQueryCache();
        startTransition(() => {
          void signOut();
        });
      }}
      className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink disabled:opacity-60"
    >
      <SignOut aria-hidden weight="bold" className="size-[1.125rem]" />
    </button>
  );
}

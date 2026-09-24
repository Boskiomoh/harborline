"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signOut } from "@/lib/actions/auth";
import { clearBrowserQueryCache } from "@/lib/query/browser-client";

/**
 * Asks first, then clears the TanStack Query cache (in-memory and the persisted sessionStorage
 * copy) before calling the sign-out server action, so nothing from this session — ticket text,
 * customer names — is still sitting in the browser once it completes.
 */
export function SignOutButton({ label }: { label: string }) {
  const t = useTranslations("nav.signOutConfirm");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        disabled={pending}
        onClick={() => setConfirming(true)}
        className="grid size-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt hover:text-ink disabled:opacity-60"
      >
        <SignOut aria-hidden weight="bold" className="size-[1.125rem]" />
      </button>
      <ConfirmDialog
        open={confirming || pending}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          clearBrowserQueryCache();
          startTransition(() => {
            void signOut();
          });
        }}
        pending={pending}
        icon={SignOut}
        title={t("title")}
        description={t("body")}
        confirmLabel={t("confirm")}
        pendingLabel={t("pending")}
      />
    </>
  );
}

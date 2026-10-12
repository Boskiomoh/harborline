"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { signOut } from "@/lib/actions/auth";
import { clearBrowserQueryCache } from "@/lib/query/browser-client";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { useTranslations } from "next-intl";
import { FC, useState, useTransition } from "react";

interface SignOutButtonProps {
  label: string;
}

// Clears the query cache (in memory and the persisted sessionStorage copy)
// before the sign-out action runs, so no ticket text or customer names are left
// sitting in the browser once it completes.
const SignOutButton: FC<SignOutButtonProps> = ({ label }) => {
  const t = useTranslations("nav.signOutConfirm");

  // State
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Handlers
  const handleConfirm = () => {
    clearBrowserQueryCache();
    startTransition(() => {
      void signOut();
    });
  };

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

      {/* Sign Out Confirm Dialog */}
      <ConfirmDialog
        open={confirming || pending}
        onClose={() => setConfirming(false)}
        onConfirm={handleConfirm}
        pending={pending}
        icon={SignOut}
        title={t("title")}
        description={t("body")}
        confirmLabel={t("confirm")}
        pendingLabel={t("pending")}
      />
    </>
  );
};

export default SignOutButton;

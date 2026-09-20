import Link from "next/link";
import { useTranslations } from "next-intl";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClass } from "@/components/ui/button";

export default function InboxTicketNotFound() {
  const t = useTranslations("states");
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8">
      <EmptyState
        icon={<MagnifyingGlass aria-hidden weight="bold" className="size-6" />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/inbox" className={buttonClass({ variant: "secondary" })}>
            {t("backToInbox")}
          </Link>
        }
      />
    </div>
  );
}

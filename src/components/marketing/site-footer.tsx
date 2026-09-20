import Link from "next/link";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter() {
  const t = useTranslations();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Wordmark className="text-lg" />
        <p className="text-sm text-ink-soft">{t("landing.footer.note")}</p>
        <Link href="/sign-in" className="text-sm font-medium text-accent-ink underline-offset-4 hover:underline">
          {t("nav.signIn")}
        </Link>
      </div>
    </footer>
  );
}

import Wordmark from "@/components/brand/wordmark";
import { buttonClass } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC } from "react";

const SiteHeader: FC = () => {
  const t = useTranslations();

  return (
    <header className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-[4.5rem] sm:px-8">
      <Link
        href="/"
        aria-label={t("brand.home")}
        className="-mx-1 rounded-[8px] px-1 py-1"
      >
        <Wordmark />
      </Link>
      <nav
        aria-label={t("nav.primary")}
        className="flex items-center gap-1 sm:gap-2"
      >
        <Link
          href="#how-it-works"
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          {t("nav.howItWorks")}
        </Link>
        <Link
          href="/sign-in"
          className={buttonClass({ variant: "secondary", size: "sm" })}
        >
          {t("nav.signIn")}
        </Link>
      </nav>
    </header>
  );
};

export default SiteHeader;

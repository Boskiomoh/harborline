import { buttonClass } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { FC } from "react";
import HeroPreview from "./hero-preview";

const Hero: FC = () => {
  const t = useTranslations("landing.hero");

  return (
    <section className="mx-auto grid max-w-7xl gap-14 px-5 pt-8 pb-20 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-10 lg:pt-14 lg:pb-28">
      <div className="lg:col-span-6 lg:pr-4">
        <h1 className="font-display text-[2.875rem] leading-[1.02] font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_84] sm:text-6xl lg:text-[4.5rem]">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-ink-soft sm:text-xl">
          {t("body")}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/sign-in" className={buttonClass({ size: "lg" })}>
            {t("primary")}
          </Link>
          <Link
            href="#how-it-works"
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("secondary")}
          </Link>
        </div>
      </div>

      <div className="lg:col-span-6">
        <HeroPreview />
      </div>
    </section>
  );
};

export default Hero;

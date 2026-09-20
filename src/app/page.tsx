import { useTranslations } from "next-intl";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { TwoViews } from "@/components/marketing/two-views";
import { DemoRoles } from "@/components/marketing/demo-roles";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SkipLink } from "@/components/ui/skip-link";

export default function HomePage() {
  const t = useTranslations("nav");

  return (
    <>
      <SkipLink label={t("skipToContent")} />
      <SiteHeader />
      <main id="main">
        <Hero />
        <HowItWorks />
        <TwoViews />
        <DemoRoles />
      </main>
      <SiteFooter />
    </>
  );
}

import DemoRoles from "@/components/marketing/demo-roles";
import Hero from "@/components/marketing/hero";
import HowItWorks from "@/components/marketing/how-it-works";
import SiteFooter from "@/components/marketing/site-footer";
import SiteHeader from "@/components/marketing/site-header";
import TwoViews from "@/components/marketing/two-views";
import { SkipLink } from "@/components/ui/skip-link";
import { NextPage } from "next";
import { useTranslations } from "next-intl";

const HomePage: NextPage = () => {
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
};

export default HomePage;

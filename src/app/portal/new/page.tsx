import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewTicketWizard } from "@/components/tickets/new-ticket-wizard";
import { requireRole } from "@/lib/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.new");
  return { title: t("metaTitle") };
}

export default async function NewTicketPage() {
  await requireRole(["customer"]);
  const t = await getTranslations("portal.new");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 lg:py-12">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink [font-variation-settings:'wdth'_86]">{t("title")}</h1>
      <NewTicketWizard />
    </div>
  );
}

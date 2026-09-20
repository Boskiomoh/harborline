import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Tray } from "@phosphor-icons/react/dist/ssr";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("metaTitle") };
}

export default async function InboxIndexPage() {
  const t = await getTranslations("inbox.select");

  return (
    <div className="grid min-h-full place-items-center px-8 py-16">
      <EmptyState className="w-full max-w-md border-none" icon={<Tray aria-hidden weight="duotone" className="size-7" />} title={t("title")} body={t("body")} />
    </div>
  );
}

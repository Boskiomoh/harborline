import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { requireRole } from "@/lib/auth";
import { getAnalytics } from "@/lib/analytics";
import { getQueryClient } from "@/lib/query/get-query-client";
import { qk } from "@/lib/query/keys";

const DAYS = 30;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics");
  return { title: t("metaTitle") };
}

export default async function AnalyticsPage() {
  await requireRole(["admin"]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: qk.analytics(DAYS), queryFn: () => getAnalytics(DAYS) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalyticsView />
    </HydrationBoundary>
  );
}

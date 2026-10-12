import AnalyticsView from "@/components/analytics/analytics-view";
import { getAnalytics } from "@/lib/analytics";
import { requireRole } from "@/lib/auth";
import { getQueryClient } from "@/lib/query/get-query-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics");

  return { title: t("metaTitle") };
}

const AnalyticsPage = async () => {
  await requireRole(["admin"]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["analytics", 30],
    queryFn: () => getAnalytics(30),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnalyticsView />
    </HydrationBoundary>
  );
};

export default AnalyticsPage;

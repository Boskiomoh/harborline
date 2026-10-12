import PortalTicketList from "@/components/portal/ticket-list";
import { requireRole } from "@/lib/auth";
import { getQueryClient } from "@/lib/query/get-query-client";
import { getMyTicketsList } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.list");

  return { title: t("metaTitle") };
}

const PortalPage = async () => {
  await requireRole(["customer"]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["my-tickets"],
    queryFn: getMyTicketsList,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortalTicketList serverNow={getRequestNow()} />
    </HydrationBoundary>
  );
};

export default PortalPage;

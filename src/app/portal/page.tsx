import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PortalTicketList } from "@/components/portal/ticket-list";
import { requireRole } from "@/lib/auth";
import { getMyTicketsList } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { getQueryClient } from "@/lib/query/get-query-client";
import { qk } from "@/lib/query/keys";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("portal.list");
  return { title: t("metaTitle") };
}

export default async function PortalPage() {
  await requireRole(["customer"]);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({ queryKey: qk.myTickets(), queryFn: getMyTicketsList });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PortalTicketList serverNow={getRequestNow()} />
    </HydrationBoundary>
  );
}

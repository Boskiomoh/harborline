import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { CustomerTicketView } from "@/components/tickets/customer-ticket-view";
import { requireRole } from "@/lib/auth";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { getQueryClient } from "@/lib/query/get-query-client";
import { qk } from "@/lib/query/keys";

export async function generateMetadata({ params }: PageProps<"/portal/tickets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("portal.ticket");
  return { title: t("metaTitle", { id }) };
}

export default async function CustomerTicketPage({ params, searchParams }: PageProps<"/portal/tickets/[id]">) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const viewer = await requireRole(["customer"]);
  const [detail, query] = await Promise.all([getTicketDetailForViewer(ticketId, viewer), searchParams]);
  if (!detail) notFound();

  const queryClient = getQueryClient();
  // Already fetched above (had to inspect it for notFound()), so seed the cache directly rather
  // than fetching it again through prefetchQuery.
  queryClient.setQueryData(qk.ticket(ticketId), detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CustomerTicketView
        ticketId={ticketId}
        viewerId={viewer.id}
        serverNow={getRequestNow()}
        created={query.created === "1"}
        uploadFailed={query.upload === "failed"}
      />
    </HydrationBoundary>
  );
}

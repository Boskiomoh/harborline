import CustomerTicketView from "@/components/tickets/customer-ticket-view";
import { requireRole } from "@/lib/auth";
import { getQueryClient } from "@/lib/query/get-query-client";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/portal/tickets/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("portal.ticket");

  return { title: t("metaTitle", { id }) };
}

const CustomerTicketPage = async ({
  params,
  searchParams,
}: PageProps<"/portal/tickets/[id]">) => {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const viewer = await requireRole(["customer"]);
  const [detail, query] = await Promise.all([
    getTicketDetailForViewer(ticketId, viewer),
    searchParams,
  ]);
  if (!detail) notFound();

  const queryClient = getQueryClient();
  // Already fetched above (it had to be inspected for notFound()).
  await queryClient.prefetchQuery({
    queryKey: ["single-ticket", ticketId],
    queryFn: () => detail,
  });

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
};

export default CustomerTicketPage;

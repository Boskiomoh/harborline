import AgentTicketView from "@/components/inbox/agent-ticket-view";
import { requireRole } from "@/lib/auth";
import { getCannedResponses } from "@/lib/inbox";
import { getQueryClient } from "@/lib/query/get-query-client";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/inbox/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("inbox.detail");

  return { title: t("metaTitle", { id }) };
}

const InboxTicketPage = async ({ params }: PageProps<"/inbox/[id]">) => {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const viewer = await requireRole(["agent", "admin"]);
  const detail = await getTicketDetailForViewer(ticketId, viewer);
  if (!detail) notFound();

  const queryClient = getQueryClient();
  await Promise.all([
    // Already fetched above (it had to be inspected for notFound()).
    queryClient.prefetchQuery({
      queryKey: ["single-ticket", ticketId],
      queryFn: () => detail,
    }),
    queryClient.prefetchQuery({
      queryKey: ["canned-responses"],
      queryFn: getCannedResponses,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Remount per ticket so live state and the composer never leak between tickets. */}
      <AgentTicketView
        key={ticketId}
        ticketId={ticketId}
        viewerId={viewer.id}
        serverNow={getRequestNow()}
      />
    </HydrationBoundary>
  );
};

export default InboxTicketPage;

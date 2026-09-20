import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AgentTicketView } from "@/components/inbox/agent-ticket-view";
import { requireRole } from "@/lib/auth";
import { getCannedResponses } from "@/lib/inbox";
import { getTicketDetailForViewer } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { getQueryClient } from "@/lib/query/get-query-client";
import { qk } from "@/lib/query/keys";

export async function generateMetadata({ params }: PageProps<"/inbox/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("inbox.detail");
  return { title: t("metaTitle", { id }) };
}

export default async function InboxTicketPage({ params }: PageProps<"/inbox/[id]">) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const viewer = await requireRole(["agent", "admin"]);
  const detail = await getTicketDetailForViewer(ticketId, viewer);
  if (!detail) notFound();

  const queryClient = getQueryClient();
  // Already fetched above (had to inspect it for notFound()), so seed the cache directly.
  queryClient.setQueryData(qk.ticket(ticketId), detail);
  await queryClient.prefetchQuery({ queryKey: qk.cannedResponses(), queryFn: getCannedResponses });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Remount per ticket so live state and the composer never leak between tickets. */}
      <AgentTicketView key={ticketId} ticketId={ticketId} viewerId={viewer.id} serverNow={getRequestNow()} />
    </HydrationBoundary>
  );
}

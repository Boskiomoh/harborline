import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { InboxProvider } from "@/components/inbox/inbox-provider";
import { InboxFrame } from "@/components/inbox/inbox-frame";
import { InboxList } from "@/components/inbox/inbox-list";
import { requireRole } from "@/lib/auth";
import { getInboxTickets, getStaff } from "@/lib/inbox";
import { getSlaTargets } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { getQueryClient } from "@/lib/query/get-query-client";
import { qk } from "@/lib/query/keys";

export default async function InboxLayout({ children }: LayoutProps<"/inbox">) {
  const viewer = await requireRole(["agent", "admin"]);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: qk.inbox(), queryFn: getInboxTickets }),
    queryClient.prefetchQuery({ queryKey: qk.staff(), queryFn: getStaff }),
    queryClient.prefetchQuery({ queryKey: qk.slaPolicies(), queryFn: getSlaTargets }),
  ]);

  return (
    <AppShell viewer={viewer}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InboxProvider viewerId={viewer.id}>
          <InboxFrame list={<InboxList serverNow={getRequestNow()} />}>{children}</InboxFrame>
        </InboxProvider>
      </HydrationBoundary>
    </AppShell>
  );
}

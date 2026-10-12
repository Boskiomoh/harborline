import AppShell from "@/components/app/app-shell";
import InboxFrame from "@/components/inbox/inbox-frame";
import InboxList from "@/components/inbox/inbox-list";
import { InboxProvider } from "@/components/inbox/inbox-provider";
import { requireRole } from "@/lib/auth";
import { getInboxTickets, getStaff } from "@/lib/inbox";
import { getQueryClient } from "@/lib/query/get-query-client";
import { getSlaTargets } from "@/lib/tickets";
import { getRequestNow } from "@/lib/time";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

const InboxLayout = async ({ children }: LayoutProps<"/inbox">) => {
  const viewer = await requireRole(["agent", "admin"]);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["inbox"],
      queryFn: getInboxTickets,
    }),
    queryClient.prefetchQuery({ queryKey: ["staff"], queryFn: getStaff }),
    queryClient.prefetchQuery({
      queryKey: ["sla-policies"],
      queryFn: getSlaTargets,
    }),
  ]);

  return (
    <AppShell viewer={viewer}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InboxProvider viewerId={viewer.id}>
          <InboxFrame list={<InboxList serverNow={getRequestNow()} />}>
            {children}
          </InboxFrame>
        </InboxProvider>
      </HydrationBoundary>
    </AppShell>
  );
};

export default InboxLayout;

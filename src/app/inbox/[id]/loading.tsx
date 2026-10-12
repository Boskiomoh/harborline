import { Skeleton } from "@/components/ui/skeleton";

export default function InboxTicketLoading() {
  return (
    <div
      className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8"
      aria-busy="true"
    >
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-3 h-9 w-3/4" />
      <Skeleton className="mt-3 h-5 w-40" />
      <Skeleton className="mt-5 h-[4.5rem] border border-border bg-surface" />
      <div className="mt-8 grid gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-28 border border-border bg-surface" />
      </div>
      <Skeleton className="mt-8 h-44 border border-border bg-surface" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function TicketLoading() {
  return (
    <div
      className="mx-auto max-w-3xl px-4 py-6 sm:px-8 lg:py-10"
      aria-busy="true"
    >
      <Skeleton className="h-5 w-28" />
      <Skeleton className="mt-6 h-4 w-44" />
      <Skeleton className="mt-3 h-10 w-4/5" />
      <Skeleton className="mt-4 h-7 w-36 rounded-full" />
      <div className="mt-8 grid gap-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-28 border border-border bg-surface" />
      </div>
      <Skeleton className="mt-8 h-40 border border-border bg-surface" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div
      className="mx-auto max-w-6xl px-4 py-8 sm:px-8 lg:py-12"
      aria-busy="true"
    >
      <Skeleton className="h-10 w-44" />
      <Skeleton className="mt-3 h-5 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 border border-border bg-surface" />
        <Skeleton className="h-36 border border-border bg-surface" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-96 border border-border bg-surface lg:col-span-3" />
        <Skeleton className="h-96 border border-border bg-surface lg:col-span-2" />
      </div>
    </div>
  );
}

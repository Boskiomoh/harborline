import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8 lg:py-12" aria-busy="true">
      <div className="flex items-end justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <Skeleton className="mt-8 h-11 w-52 rounded-full" />
      <div className="mt-6 grid gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[4.75rem] border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}

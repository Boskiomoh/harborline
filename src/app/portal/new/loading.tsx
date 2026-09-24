import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the wizard's first step (title, step rail, category tiles) so nothing jumps when it lands.
export default function NewTicketLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8 lg:py-12" aria-busy="true">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-6 h-8 w-full max-w-md rounded-full" />
      <div className="mt-8 rounded-[8px] border border-border bg-surface p-5 shadow-raised sm:p-7">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2.5 h-4 w-72 max-w-full" />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className={i === 4 ? "h-[4.5rem] sm:col-span-2" : "h-[4.5rem]"} />
          ))}
        </div>
      </div>
    </div>
  );
}

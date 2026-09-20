"use client";

import { cn } from "@/lib/cn";
import { useInbox } from "./inbox-provider";

/** Two panes from xl up. Below that, the list and the open ticket take turns. */
export function InboxFrame({ list, children }: { list: React.ReactNode; children: React.ReactNode }) {
  const { activeId } = useInbox();
  const detailOpen = activeId !== null;

  return (
    // Each pane is `relative` so absolutely positioned descendants (sr-only labels) stay inside
    // the pane's scroll clip instead of stretching the document and adding a page scrollbar.
    <div className="xl:grid xl:h-dvh xl:grid-cols-[minmax(22rem,27rem)_minmax(0,1fr)]">
      <section className={cn("relative min-w-0 border-border xl:overflow-y-auto xl:border-r", detailOpen && "hidden xl:block")}>{list}</section>
      <section className={cn("relative min-w-0 xl:overflow-y-auto", !detailOpen && "hidden xl:block")}>{children}</section>
    </div>
  );
}

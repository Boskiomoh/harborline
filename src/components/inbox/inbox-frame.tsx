"use client";

import { cn } from "@/lib/cn";
import { FC, type ReactNode } from "react";
import { useInbox } from "./inbox-provider";

interface InboxFrameProps {
  list: ReactNode;
  children: ReactNode;
}

// Two panes from xl up. Below that, the list and the open ticket take turns.
const InboxFrame: FC<InboxFrameProps> = ({ list, children }) => {
  // Stores
  const { activeId } = useInbox();

  // Derived
  const detailOpen = activeId !== null;

  return (
    // Each pane is `relative` so absolutely positioned descendants (sr-only labels) stay inside
    // the pane's scroll clip instead of stretching the document and adding a page scrollbar.
    <div className="xl:grid xl:h-dvh xl:grid-cols-[minmax(22rem,27rem)_minmax(0,1fr)]">
      <section
        className={cn(
          "relative min-w-0 border-border xl:overflow-y-auto xl:border-r",
          detailOpen && "hidden xl:block",
        )}
      >
        {list}
      </section>
      <section
        className={cn(
          "relative min-w-0 xl:overflow-y-auto",
          !detailOpen && "hidden xl:block",
        )}
      >
        {children}
      </section>
    </div>
  );
};

export default InboxFrame;

"use client";

import { useSyncExternalStore } from "react";

// One shared 1s ticker for every live clock on the page, instead of an interval per badge.
const listeners = new Set<() => void>();
// getSnapshot must return a stable value between ticks, so the time is only read when the ticker fires.
let current = typeof window === "undefined" ? 0 : Date.now();
let timer: ReturnType<typeof setInterval> | undefined;

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }

  // Swap from the server snapshot to live time right after hydration, not a second later.
  queueMicrotask(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
};

// `null` during SSR and hydration so server and client markup match.
const useNow = (): number | null =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

export default useNow;

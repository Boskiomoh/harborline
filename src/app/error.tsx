"use client";

import { ErrorState } from "@/components/ui/error-state";

export default function RootError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState retry={retry} />;
}

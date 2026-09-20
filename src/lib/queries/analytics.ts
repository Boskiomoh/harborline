"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { analyticsDataSchema } from "@/lib/api/schemas";
import { qk } from "@/lib/query/keys";

export function useAnalyticsQuery(days: number) {
  return useQuery({
    queryKey: qk.analytics(days),
    queryFn: () => apiFetch(`/api/analytics?days=${days}`, analyticsDataSchema),
  });
}

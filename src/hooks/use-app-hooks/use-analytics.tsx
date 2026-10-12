"use client";

import { apiInstance } from "@/lib/api/instance";
import { useQuery } from "@tanstack/react-query";

const useAnalytics = (days: number) =>
  useQuery({
    queryKey: ["analytics", days],
    queryFn: async () => {
      try {
        const res = await apiInstance.get(`/api/analytics?days=${days}`);

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    enabled: !!days,
  });

export { useAnalytics };

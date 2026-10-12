"use client";

import { apiInstance } from "@/lib/api/instance";
import { useQuery } from "@tanstack/react-query";

const useInboxTickets = () =>
  useQuery({
    queryKey: ["inbox"],
    queryFn: async () => {
      try {
        const res = await apiInstance.get("/api/inbox");

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
  });

const useStaff = () =>
  useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      try {
        const res = await apiInstance.get("/api/staff");

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
  });

const useCannedResponses = () =>
  useQuery({
    queryKey: ["canned-responses"],
    queryFn: async () => {
      try {
        const res = await apiInstance.get("/api/canned-responses");

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
  });

const useSlaPolicies = () =>
  useQuery({
    queryKey: ["sla-policies"],
    queryFn: async () => {
      try {
        const res = await apiInstance.get("/api/sla-policies");

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
  });

export { useCannedResponses, useInboxTickets, useSlaPolicies, useStaff };

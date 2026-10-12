"use client";

import { apiInstance } from "@/lib/api/instance";
import { useQuery } from "@tanstack/react-query";

const useMyTickets = () =>
  useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => {
      try {
        const res = await apiInstance.get("/api/tickets");

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
  });

const useSingleTicket = (single_ticket: number) =>
  useQuery({
    queryKey: ["single-ticket", single_ticket],
    queryFn: async () => {
      try {
        const res = await apiInstance.get(`/api/tickets/${single_ticket}`);

        return res.data;
      } catch (error) {
        throw error;
      }
    },
    retry: 1,
    enabled: !!single_ticket,
  });

export { useMyTickets, useSingleTicket };

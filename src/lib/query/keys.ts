/**
 * Central query-key factory. Every server-side prefetch and every client hook builds keys
 * through here, so a prefetched query and the hook reading it always agree on the key.
 */
export const qk = {
  myTickets: () => ["myTickets"] as const,
  ticket: (id: number) => ["tickets", id] as const,
  inbox: () => ["inbox"] as const,
  staff: () => ["staff"] as const,
  cannedResponses: () => ["cannedResponses"] as const,
  slaPolicies: () => ["slaPolicies"] as const,
  analytics: (days: number) => ["analytics", days] as const,
  aiTriage: (ticketId: number) => ["ai", "triage", ticketId] as const,
};

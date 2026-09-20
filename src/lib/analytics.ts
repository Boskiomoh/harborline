import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";

export type StatusDay = {
  day: string;
  new_count: number;
  in_progress_count: number;
  waiting_count: number;
  resolved_count: number;
};

export type CategoryRow = { category: Enums<"ticket_category">; ord: number; open_count: number; resolved_count: number };

export type PriorityRow = {
  priority: Enums<"ticket_priority">;
  rank: number;
  target_minutes: number;
  tickets: number;
  avg_minutes: number | null;
  breaches: number;
};

/** Shape returned by the public.admin_analytics() RPC. */
export type AnalyticsData = {
  from: string;
  to: string;
  totalTickets: number;
  respondedCount: number;
  avgFirstResponseMinutes: number | null;
  lateResponses: number;
  overdueOpen: number;
  byPriority: PriorityRow[];
  byCategory: CategoryRow[];
  statusDaily: StatusDay[];
};

/** Calls the `admin_analytics` RPC (admin-only; enforced by the function itself, see the migration). */
export async function getAnalytics(days: number): Promise<AnalyticsData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", { p_days: days });
  if (error) throw error;
  return data as unknown as AnalyticsData;
}

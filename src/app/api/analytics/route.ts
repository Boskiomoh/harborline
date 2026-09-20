import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { analyticsDataSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/api/guard";
import { getAnalytics } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(["admin"]);
  if ("response" in auth) return auth.response;

  const days = Number(request.nextUrl.searchParams.get("days") ?? "30") || 30;
  const data = await getAnalytics(days);
  return NextResponse.json(analyticsDataSchema.parse(data));
}

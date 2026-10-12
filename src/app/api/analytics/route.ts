import { getAnalytics } from "@/lib/analytics";
import { apiError, requireApiRole } from "@/lib/api/guard";
import { NextRequest, NextResponse } from "next/server";

// Get the admin analytics for the last `days` days (default 30)
export async function GET(req: NextRequest) {
  const auth = await requireApiRole(["admin"]);
  if ("response" in auth) return auth.response;

  const days = Number(req.nextUrl.searchParams.get("days") ?? "30") || 30;

  try {
    const data = await getAnalytics(days);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[analytics] get:", error);
    return apiError(500, { error: "generic" });
  }
}

import { apiError, requireApiRole } from "@/lib/api/guard";
import { getCannedResponses } from "@/lib/inbox";
import { NextResponse } from "next/server";

// Get all canned responses
export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  try {
    const data = await getCannedResponses();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[canned-responses] list:", error);
    return apiError(500, { error: "generic" });
  }
}

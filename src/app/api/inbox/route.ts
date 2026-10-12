import { apiError, requireApiRole } from "@/lib/api/guard";
import { getInboxTickets } from "@/lib/inbox";
import { NextResponse } from "next/server";

// Get every ticket in the staff inbox
export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  try {
    const data = await getInboxTickets();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[inbox] list:", error);
    return apiError(500, { error: "generic" });
  }
}

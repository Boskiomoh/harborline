import { apiError, requireApiRole } from "@/lib/api/guard";
import { getStaff } from "@/lib/inbox";
import { NextResponse } from "next/server";

// Get all agents and admins
export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  try {
    const data = await getStaff();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[staff] list:", error);
    return apiError(500, { error: "generic" });
  }
}

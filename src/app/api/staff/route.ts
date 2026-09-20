import { NextResponse } from "next/server";
import { staffListSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/api/guard";
import { getStaff } from "@/lib/inbox";

export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  const staff = await getStaff();
  return NextResponse.json(staffListSchema.parse(staff));
}

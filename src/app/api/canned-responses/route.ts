import { NextResponse } from "next/server";
import { cannedResponsesSchema } from "@/lib/api/schemas";
import { requireApiRole } from "@/lib/api/guard";
import { getCannedResponses } from "@/lib/inbox";

export async function GET() {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth.response;

  const canned = await getCannedResponses();
  return NextResponse.json(cannedResponsesSchema.parse(canned));
}

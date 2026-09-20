import { NextResponse } from "next/server";
import { slaTargetsSchema } from "@/lib/api/schemas";
import { requireApiViewer } from "@/lib/api/guard";
import { getSlaTargets } from "@/lib/tickets";

export async function GET() {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  const targets = await getSlaTargets();
  return NextResponse.json(slaTargetsSchema.parse(targets));
}

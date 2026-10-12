import { apiError, requireApiViewer } from "@/lib/api/guard";
import { getSlaTargets } from "@/lib/tickets";
import { NextResponse } from "next/server";

// Get the first-response target for each priority
export async function GET() {
  const auth = await requireApiViewer();
  if ("response" in auth) return auth.response;

  try {
    const data = await getSlaTargets();

    return NextResponse.json(data);
  } catch (error) {
    console.error("[sla-policies] list:", error);
    return apiError(500, { error: "generic" });
  }
}

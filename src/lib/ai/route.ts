/**
 * Shared preamble for the three `/api/tickets/[id]/ai/*` route handlers, in the order the spec
 * requires: staff-only guard (401 signed out, 403 customer), then the per-viewer rate limit, then
 * the ticket itself (RLS-scoped, same data function the ticket page uses).
 */
import { apiError, parseIdParam, requireApiRole } from "@/lib/api/guard";
import type { Viewer } from "@/lib/auth";
import { getTicketDetailForViewer, type TicketDetail } from "@/lib/tickets";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { checkAiRateLimit } from "./ratelimit";

export const AI_UNAVAILABLE_MESSAGE = "AI assist isn't available right now.";

export function aiUnavailable() {
  return apiError(503, {
    error: "unavailable",
    message: AI_UNAVAILABLE_MESSAGE,
  });
}

export async function prepareAiRequest(
  rawId: string,
): Promise<
  { viewer: Viewer; detail: TicketDetail } | { response: NextResponse }
> {
  const auth = await requireApiRole(["agent", "admin"]);
  if ("response" in auth) return auth;

  const parsedId = parseIdParam(rawId);
  if ("response" in parsedId) return parsedId;

  // On Vercel the first x-forwarded-for hop is the real client; the platform overwrites it.
  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-forwarded-for")?.split(",")[0] ??
    requestHeaders.get("x-real-ip");
  const limit = await checkAiRateLimit(auth.viewer.id, clientIp);
  if (!limit.allowed) {
    const response = apiError(429, {
      error: "rate_limited",
      message: `You've used today's AI assist allowance (${limit.limit} requests). It resets at midnight UTC.`,
    });
    response.headers.set(
      "Retry-After",
      String(
        Math.max(1, Math.ceil((Date.parse(limit.resetAt) - Date.now()) / 1000)),
      ),
    );
    return { response };
  }

  const detail = await getTicketDetailForViewer(parsedId.id, auth.viewer);
  if (!detail) return { response: apiError(404, { error: "not_found" }) };

  return { viewer: auth.viewer, detail };
}

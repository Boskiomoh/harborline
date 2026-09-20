import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer, type Viewer } from "@/lib/auth";
import type { Role } from "@/lib/roles";
import type { ApiErrorBody } from "./schemas";

export function apiError(status: number, body: ApiErrorBody) {
  return NextResponse.json(body, { status });
}

export type Guarded = { viewer: Viewer } | { response: NextResponse };

/** 401 if signed out, 403 if signed in but the wrong role. */
export async function requireApiRole(allowed: Role[]): Promise<Guarded> {
  const viewer = await getViewer();
  if (!viewer) return { response: apiError(401, { error: "unauthorized" }) };
  if (!allowed.includes(viewer.role)) return { response: apiError(403, { error: "forbidden" }) };
  return { viewer };
}

export async function requireApiViewer(): Promise<Guarded> {
  const viewer = await getViewer();
  if (!viewer) return { response: apiError(401, { error: "unauthorized" }) };
  return { viewer };
}

/** Parses a request body with `schema`; returns a 400 response on failure. */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { response: apiError(400, { error: "invalid", message: "Body must be valid JSON." }) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      response: apiError(400, {
        error: "invalid",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      }),
    };
  }
  return { data: parsed.data };
}

/** Parses a numeric `[id]` route param; returns a 404 response if it isn't one. */
export function parseIdParam(id: string): { id: number } | { response: NextResponse } {
  const value = Number(id);
  if (!Number.isInteger(value) || value <= 0) return { response: apiError(404, { error: "not_found" }) };
  return { id: value };
}

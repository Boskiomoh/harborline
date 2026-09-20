import { z } from "zod";
import { apiErrorSchema, type ApiErrorBody } from "./schemas";

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message ?? body.error);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Fetches `url`, parses the JSON body with `schema` on success or `apiErrorSchema` on failure,
 * and throws `ApiError` on any non-2xx response. Query hooks and mutations both go through this,
 * so every response TanStack Query caches has already been shape-checked at the boundary.
 */
export async function apiFetch<T extends z.ZodType>(
  url: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiError(response.status, parsed.success ? parsed.data : { error: "generic" });
  }

  return schema.parse(json);
}

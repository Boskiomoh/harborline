import type { ApiErrorBody } from "./schemas";

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

const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const data = await response.json();

  if (!response.ok) throw new ApiError(response.status, data);

  return { data };
};

export const apiInstance = {
  get: (url: string) => request(url),
  post: (url: string, body?: unknown) =>
    request(url, { method: "POST", body: JSON.stringify(body) }),
  patch: (url: string, body: unknown) =>
    request(url, { method: "PATCH", body: JSON.stringify(body) }),
};

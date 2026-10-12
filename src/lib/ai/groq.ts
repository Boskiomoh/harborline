/**
 * Groq client — the primary model for AI Assist (docs/AI-ASSIST.md §2).
 *
 * Plain `fetch` against Groq's OpenAI-compatible API, no SDK. `gemini.ts` exposes the exact same
 * surface (`ChatProvider`), so `assist.ts` can fall back from one to the other without either
 * route handler knowing which model answered.
 *
 * Model: `GROQ_MODEL`, defaulting to `openai/gpt-oss-120b`. Llama 3.3 70B (the doc's usual pick)
 * isn't offered on this account; gpt-oss-120b is, and it supports strict JSON-schema output.
 * If the free tier feels tight, set `GROQ_MODEL=openai/gpt-oss-20b` rather than going paid.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** A JSON Schema the reply must match. Providers enforce it where they can; callers still Zod-parse. */
export type JsonSchemaSpec = { name: string; schema: Record<string, unknown> };

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type ChatProvider = {
  name: "groq" | "gemini";
  isConfigured: () => boolean;
  /** JSON mode: resolves to the model's raw JSON text. Throws `AiProviderError` on any failure. */
  chat: (
    messages: ChatMessage[],
    options: ChatOptions & { json: JsonSchemaSpec },
  ) => Promise<string>;
  /**
   * Streaming text. Resolves only once the provider has accepted the request (so a rate limit or
   * outage throws here, before any bytes reach the client, and the caller can still fall back).
   */
  streamChat: (
    messages: ChatMessage[],
    options?: ChatOptions,
  ) => Promise<AsyncIterable<string>>;
};

export class AiProviderError extends Error {
  readonly provider: ChatProvider["name"];
  readonly status: number | null;

  constructor(
    provider: ChatProvider["name"],
    status: number | null,
    message: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = "AiProviderError";
    this.provider = provider;
    this.status = status;
  }
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 20_000;

function model() {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

async function request(body: Record<string, unknown>, signal?: AbortSignal) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new AiProviderError("groq", null, "GROQ_API_KEY is not set");

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model(),
        // gpt-oss models reason before answering; keep that short and out of the output.
        ...(model().startsWith("openai/gpt-oss") && {
          reasoning_effort: "low",
          include_reasoning: false,
        }),
        ...body,
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderError(
      "groq",
      null,
      error instanceof Error ? error.message : "network error",
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiProviderError(
      "groq",
      response.status,
      detail.slice(0, 300) || response.statusText,
    );
  }
  return response;
}

/** Parses an OpenAI-style SSE body into content deltas. */
async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data || data === "[DONE]") continue;
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          error?: { message?: string };
        };
        if (parsed.error)
          throw new AiProviderError(
            "groq",
            null,
            parsed.error.message ?? "stream error",
          );
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const groq: ChatProvider = {
  name: "groq",
  isConfigured: () => Boolean(process.env.GROQ_API_KEY),

  async chat(messages, { json, temperature = 0.2, maxTokens = 1024, signal }) {
    const response = await request(
      {
        messages,
        temperature,
        max_completion_tokens: maxTokens,
        response_format: {
          type: "json_schema",
          json_schema: { name: json.name, strict: true, schema: json.schema },
        },
      },
      signal,
    );
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content)
      throw new AiProviderError("groq", response.status, "empty completion");
    return content;
  },

  async streamChat(
    messages,
    { temperature = 0.4, maxTokens = 1024, signal } = {},
  ) {
    const response = await request(
      { messages, temperature, max_completion_tokens: maxTokens, stream: true },
      signal,
    );
    if (!response.body)
      throw new AiProviderError("groq", response.status, "no response body");
    return readSse(response.body);
  },
};

/**
 * Gemini client — fallback only, used when Groq is rate-limited or down (docs/AI-ASSIST.md §3).
 * Same `ChatProvider` surface as `groq.ts`. Optional: with no `GEMINI_API_KEY` it reports itself
 * unconfigured and `assist.ts` skips it.
 *
 * Model: `GEMINI_MODEL`, defaulting to `gemini-2.5-flash`.
 */
import { AiProviderError, type ChatMessage, type ChatProvider } from "./groq";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 20_000;

function model() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/** Gemini takes the system prompt separately and calls the assistant role "model". */
function toGemini(messages: ChatMessage[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return { ...(system && { systemInstruction: { parts: [{ text: system }] } }), contents };
}

async function request(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AiProviderError("gemini", null, "GEMINI_API_KEY is not set");

  let response: Response;
  try {
    response = await fetch(`${BASE}/${model()}:${path}`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiProviderError("gemini", null, error instanceof Error ? error.message : "network error");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AiProviderError("gemini", response.status, detail.slice(0, 300) || response.statusText);
  }
  return response;
}

type GeminiChunk = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

function textOf(chunk: GeminiChunk) {
  return (chunk.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
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
        if (!data) continue;
        const text = textOf(JSON.parse(data) as GeminiChunk);
        if (text) yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export const gemini: ChatProvider = {
  name: "gemini",
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  async chat(messages, { json, temperature = 0.2, maxTokens = 1024, signal }) {
    const response = await request(
      "generateContent",
      {
        ...toGemini(messages),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          responseJsonSchema: json.schema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      },
      signal,
    );
    const content = textOf((await response.json()) as GeminiChunk);
    if (!content) throw new AiProviderError("gemini", response.status, "empty completion");
    return content;
  },

  async streamChat(messages, { temperature = 0.4, maxTokens = 1024, signal } = {}) {
    const response = await request(
      "streamGenerateContent?alt=sse",
      { ...toGemini(messages), generationConfig: { temperature, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } } },
      signal,
    );
    if (!response.body) throw new AiProviderError("gemini", response.status, "no response body");
    return readSse(response.body);
  },
};

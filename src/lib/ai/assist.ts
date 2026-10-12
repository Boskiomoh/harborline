/**
 * Provider fallback for AI Assist: Groq first, Gemini if Groq fails (docs/AI-ASSIST.md §3, §9).
 * Route handlers call these two functions and never touch a provider directly. When nothing is
 * configured or every provider fails, they throw `AiUnavailableError`, which the routes turn into
 * a calm 503 the UI renders as "AI assist isn't available right now".
 */
import { z } from "zod";
import { gemini } from "./gemini";
import {
  groq,
  type ChatMessage,
  type ChatOptions,
  type ChatProvider,
  type JsonSchemaSpec,
} from "./groq";

export class AiUnavailableError extends Error {
  constructor(message = "No AI provider is available") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const PROVIDERS: ChatProvider[] = [groq, gemini];

function configured() {
  return PROVIDERS.filter((p) => p.isConfigured());
}

/**
 * JSON completion, validated with `schema`. A provider whose reply doesn't parse or doesn't match
 * the schema counts as a failure and the next provider is tried — so a caller only ever sees a
 * value that passed `schema`, never a made-up enum value.
 */
export async function chatJson<T extends z.ZodType>(
  messages: ChatMessage[],
  schema: T,
  options: ChatOptions & { json: JsonSchemaSpec },
): Promise<{ data: z.infer<T>; provider: ChatProvider["name"] }> {
  for (const provider of configured()) {
    try {
      const raw = await provider.chat(messages, options);
      const parsed = schema.safeParse(JSON.parse(raw));
      if (parsed.success) return { data: parsed.data, provider: provider.name };
      console.error(
        `[ai] ${provider.name} returned JSON that failed validation`,
        parsed.error.issues,
      );
    } catch (error) {
      console.error(
        `[ai] ${provider.name} chat failed`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw new AiUnavailableError();
}

/** Streaming completion from the first provider that accepts the request. */
export async function streamChat(
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<{ stream: AsyncIterable<string>; provider: ChatProvider["name"] }> {
  for (const provider of configured()) {
    try {
      return {
        stream: await provider.streamChat(messages, options),
        provider: provider.name,
      };
    } catch (error) {
      console.error(
        `[ai] ${provider.name} stream failed`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  throw new AiUnavailableError();
}

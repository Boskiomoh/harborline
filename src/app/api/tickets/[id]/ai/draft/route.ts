import { aiDraftResponseSchema, type AiSource } from "@/lib/api/schemas";
import { AiUnavailableError, streamChat } from "@/lib/ai/assist";
import { DRAFT_SYSTEM_PROMPT, draftUserPrompt } from "@/lib/ai/prompts";
import { retrieveContext, type KnowledgeSource } from "@/lib/ai/retrieve";
import { aiUnavailable, prepareAiRequest } from "@/lib/ai/route";
import { customerMessages, draftThread, formatThread } from "@/lib/ai/thread";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tickets/[id]/ai/draft — staff only. Streams a suggested reply built from the public
 * thread plus the nearest canned responses and resolved-ticket replies.
 *
 * Response body (`text/plain`): one JSON line matching `aiDraftResponseSchema` (the sources used),
 * a newline, then the draft as it's generated. The draft is only ever a suggestion: this route
 * writes nothing, and the agent sends it (or doesn't) through the normal reply box.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/tickets/[id]/ai/draft">) {
  const { id } = await ctx.params;
  const prepared = await prepareAiRequest(id);
  if ("response" in prepared) return prepared.response;
  const { detail } = prepared;
  const { ticket, people } = detail;

  const thread = draftThread(detail.messages);
  const customer = people[ticket.customer_id];
  const latestCustomerText = customerMessages(thread, people).slice(-2).map((m) => m.body).join("\n\n");

  // Retrieval is best-effort: if the embed function is down, draft from the thread alone rather
  // than failing the whole request.
  let sources: KnowledgeSource[] = [];
  try {
    const supabase = await createClient();
    sources = await retrieveContext(supabase, `${ticket.subject}\n\n${latestCustomerText}`, ticket.category, 4, { excludeTicketId: ticket.id });
  } catch (error) {
    console.error("[ai] retrieval failed, drafting without sources", error instanceof Error ? error.message : error);
  }

  const header = { id: ticket.id, subject: ticket.subject, category: ticket.category, orderReference: ticket.order_reference, customerName: customer?.fullName ?? "", status: ticket.status };
  const last = thread.at(-1);
  const lastFrom = !last ? null : last.author_id && people[last.author_id]?.role === "customer" ? "customer" : "agent";
  const references = sources.map((s) =>
    s.kind === "canned_response" ? `Saved reply "${s.title ?? "untitled"}":\n${s.content}` : `Reply from solved ticket #${s.ticketId}:\n${s.content}`,
  );

  let result: Awaited<ReturnType<typeof streamChat>>;
  try {
    result = await streamChat(
      [
        { role: "system", content: DRAFT_SYSTEM_PROMPT },
        { role: "user", content: draftUserPrompt(header, formatThread(thread, people), references, lastFrom) },
      ],
      { temperature: 0.4, maxTokens: 700 },
    );
  } catch (error) {
    if (error instanceof AiUnavailableError) return aiUnavailable();
    throw error;
  }

  const meta = aiDraftResponseSchema.parse({
    provider: result.provider,
    sources: sources.map(
      (s): AiSource => ({ id: s.id, kind: s.kind, sourceId: s.sourceId, ticketId: s.ticketId, title: s.title, similarity: Number(s.similarity.toFixed(3)) }),
    ),
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify(meta)}\n`));
      try {
        for await (const chunk of result.stream) controller.enqueue(encoder.encode(chunk));
        controller.close();
      } catch (error) {
        console.error("[ai] draft stream broke mid-way", error instanceof Error ? error.message : error);
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { AiUnavailableError, chatJson } from "@/lib/ai/assist";
import {
  SUMMARY_JSON_SCHEMA,
  SUMMARY_SYSTEM_PROMPT,
  summaryUserPrompt,
} from "@/lib/ai/prompts";
import { aiUnavailable, prepareAiRequest } from "@/lib/ai/route";
import { formatThread, summaryThread } from "@/lib/ai/thread";
import { apiError } from "@/lib/api/guard";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const modelSummarySchema = z.object({ summary: z.string().trim().min(1) });

// Summarise a ticket's thread in 3–4 sentences (staff only). Internal notes are
// included only because the viewer is staff: `summaryThread` applies that rule
// explicitly rather than trusting the route guard to have implied it.
export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/api/tickets/[id]/ai/summary">,
) {
  const { id } = await ctx.params;
  const prepared = await prepareAiRequest(id);
  if ("response" in prepared) return prepared.response;

  const { viewer, detail } = prepared;
  const { ticket, people } = detail;
  const thread = summaryThread(detail.messages, viewer.role);
  const customer = people[ticket.customer_id];

  try {
    const { data } = await chatJson(
      [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: summaryUserPrompt(
            {
              id: ticket.id,
              subject: ticket.subject,
              category: ticket.category,
              orderReference: ticket.order_reference,
              customerName: customer?.fullName ?? "",
              status: ticket.status,
              priority: ticket.priority,
            },
            formatThread(thread, people),
          ),
        },
      ],
      modelSummarySchema,
      { json: SUMMARY_JSON_SCHEMA, temperature: 0.2, maxTokens: 600 },
    );

    return NextResponse.json({
      summary: data.summary,
      messageCount: thread.length,
      includesInternalNotes: thread.some((m) => m.is_internal_note),
    });
  } catch (error) {
    if (error instanceof AiUnavailableError) return aiUnavailable();

    console.error("[ai] summary:", error);
    return apiError(500, { error: "generic" });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { aiTriageResponseSchema, ticketCategorySchema, ticketPrioritySchema } from "@/lib/api/schemas";
import { apiError } from "@/lib/api/guard";
import { AiUnavailableError, chatJson } from "@/lib/ai/assist";
import { TRIAGE_SYSTEM_PROMPT, triageJsonSchema, triageUserPrompt } from "@/lib/ai/prompts";
import { aiUnavailable, prepareAiRequest } from "@/lib/ai/route";
import { customerMessages } from "@/lib/ai/thread";
import { Constants } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * What the model must return. The provider enforces the enums through a strict JSON schema, and
 * this re-checks them: a reply with a category or priority outside the real Postgres enums fails
 * here and never reaches the client — it can't invent one.
 */
const modelTriageSchema = z.object({
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  confidence: z.number().transform((v) => Math.min(1, Math.max(0, v))),
});

/**
 * POST /api/tickets/[id]/ai/triage — staff only. Suggests a category and priority for a new
 * ticket from its own text. Suggests nothing once the ticket has moved past "new" or once someone
 * has set category/priority by hand (`tickets.triaged_at`), without spending a model call.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/tickets/[id]/ai/triage">) {
  const { id } = await ctx.params;
  const prepared = await prepareAiRequest(id);
  if ("response" in prepared) return prepared.response;
  const { ticket, messages, people } = prepared.detail;

  if (ticket.status !== "new") return NextResponse.json(aiTriageResponseSchema.parse({ status: "skipped", reason: "not_new" }));

  const supabase = await createClient();
  const { data: triage, error } = await supabase.from("tickets").select("triaged_at").eq("id", ticket.id).single();
  if (error) return apiError(500, { error: "generic" });
  if (triage.triaged_at) return NextResponse.json(aiTriageResponseSchema.parse({ status: "skipped", reason: "already_triaged" }));

  const customerText = customerMessages(messages, people).map((m) => m.body).join("\n\n");

  try {
    const { data } = await chatJson(
      [
        { role: "system", content: TRIAGE_SYSTEM_PROMPT },
        { role: "user", content: triageUserPrompt({ subject: ticket.subject, orderReference: ticket.order_reference }, customerText) },
      ],
      modelTriageSchema,
      {
        json: triageJsonSchema(Constants.public.Enums.ticket_category, Constants.public.Enums.ticket_priority),
        temperature: 0,
        maxTokens: 400,
      },
    );
    return NextResponse.json(aiTriageResponseSchema.parse({ status: "suggestion", ...data }));
  } catch (error) {
    if (error instanceof AiUnavailableError) return aiUnavailable();
    throw error;
  }
}

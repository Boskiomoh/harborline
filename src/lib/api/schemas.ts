import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

/**
 * The contract between route handlers and the client.
 *
 * Route handlers build their response from the same `lib/*.ts` data functions the old
 * server-rendered pages used, then run it through `<X>Schema.parse()` before sending it —
 * this file is deliberately the one place both sides agree on the shape. Client query hooks
 * parse the fetch response with the same schema, so a shape drift on either end throws loudly
 * instead of surfacing as a silent `undefined` deep in a component.
 *
 * Dates are left as `z.string()` rather than `z.iso.datetime()`: Postgres/PostgREST timestamptz
 * values (e.g. `2026-09-16T10:07:00.123456+00:00`) are valid ISO 8601 but stricter than what
 * Zod's `datetime()` accepts, and the app only ever does `new Date(x)` / `Date.parse(x)` with them.
 */

export const roleSchema = z.enum(Constants.public.Enums.user_role);
export const ticketStatusSchema = z.enum(Constants.public.Enums.ticket_status);
export const ticketPrioritySchema = z.enum(Constants.public.Enums.ticket_priority);
export const ticketCategorySchema = z.enum(Constants.public.Enums.ticket_category);

export const personSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  role: roleSchema,
});
export const peopleSchema = z.record(z.string(), personSchema);

export const ticketCoreSchema = z.object({
  id: z.number().int(),
  customer_id: z.uuid(),
  subject: z.string(),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  assigned_agent_id: z.uuid().nullable(),
  order_reference: z.string().nullable(),
  first_response_at: z.string().nullable(),
  resolved_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ticketMessageSchema = z.object({
  id: z.number().int(),
  ticket_id: z.number().int(),
  author_id: z.uuid().nullable(),
  body: z.string(),
  is_internal_note: z.boolean(),
  created_at: z.string(),
});

export const ticketEventSchema = z.object({
  id: z.number().int(),
  ticket_id: z.number().int(),
  from_status: ticketStatusSchema.nullable(),
  to_status: ticketStatusSchema,
  changed_by: z.uuid().nullable(),
  created_at: z.string(),
});

export const ticketAttachmentSchema = z.object({
  id: z.number().int(),
  messageId: z.number().int().nullable(),
  fileName: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  url: z.string().nullable(),
});

export const slaTargetsSchema = z.record(ticketPrioritySchema, z.number().int());

export const ticketDetailSchema = z.object({
  ticket: ticketCoreSchema,
  messages: z.array(ticketMessageSchema),
  events: z.array(ticketEventSchema),
  attachments: z.array(ticketAttachmentSchema),
  people: peopleSchema,
  slaTargets: slaTargetsSchema,
});

export const myTicketRowSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  status: ticketStatusSchema,
  category: ticketCategorySchema,
  order_reference: z.string().nullable(),
  updated_at: z.string(),
});
export const myTicketsSchema = z.array(myTicketRowSchema);

export const inboxLastMessageSchema = z.object({
  body: z.string(),
  created_at: z.string(),
  is_internal_note: z.boolean(),
  author_id: z.uuid().nullable(),
});
export const inboxTicketSchema = ticketCoreSchema.extend({
  customerName: z.string(),
  lastMessage: inboxLastMessageSchema.nullable(),
});
export const inboxTicketsSchema = z.array(inboxTicketSchema);

export const staffListSchema = z.array(personSchema);

export const cannedResponseSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  body: z.string(),
  agent_id: z.uuid(),
});
export const cannedResponsesSchema = z.array(cannedResponseSchema);

export const priorityRowSchema = z.object({
  priority: ticketPrioritySchema,
  rank: z.number().int(),
  target_minutes: z.number().int(),
  tickets: z.number().int(),
  avg_minutes: z.number().nullable(),
  breaches: z.number().int(),
});

export const categoryRowSchema = z.object({
  category: ticketCategorySchema,
  ord: z.number().int(),
  open_count: z.number().int(),
  resolved_count: z.number().int(),
});

export const statusDaySchema = z.object({
  day: z.string(),
  new_count: z.number().int(),
  in_progress_count: z.number().int(),
  waiting_count: z.number().int(),
  resolved_count: z.number().int(),
});

export const analyticsDataSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalTickets: z.number().int(),
  respondedCount: z.number().int(),
  avgFirstResponseMinutes: z.number().nullable(),
  lateResponses: z.number().int(),
  overdueOpen: z.number().int(),
  byPriority: z.array(priorityRowSchema),
  byCategory: z.array(categoryRowSchema),
  statusDaily: z.array(statusDaySchema),
});

// ---- Mutation inputs -------------------------------------------------------

export const createTicketInputSchema = z.object({
  category: ticketCategorySchema,
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10_000),
  orderReference: z.string().trim().max(40).optional(),
});
export type CreateTicketInput = z.infer<typeof createTicketInputSchema>;

export const createTicketResultSchema = z.object({ ticketId: z.number().int(), messageId: z.number().int() });

export const postMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  internal: z.boolean().default(false),
  setStatus: ticketStatusSchema.optional(),
});
export type PostMessageInput = z.infer<typeof postMessageInputSchema>;

export const updateTicketInputSchema = z
  .object({
    status: ticketStatusSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    category: ticketCategorySchema.optional(),
    assignedAgentId: z.uuid().nullable().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.priority !== undefined || v.category !== undefined || v.assignedAgentId !== undefined,
    { message: "At least one of status, priority, category or assignedAgentId is required" },
  );
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;

export const recordAttachmentInputSchema = z.object({
  messageId: z.number().int().nullable(),
  // `<ticketId>/<uuid>-<name>`; the route and a database check also bind it to this ticket.
  storagePath: z.string().min(1).max(400).regex(/^\d+\/[\w.-]+$/),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
});
export type RecordAttachmentInput = z.infer<typeof recordAttachmentInputSchema>;

// ---- AI Assist (docs/AI-ASSIST.md) ------------------------------------------

/** A retrieved chunk the draft was built from, shown to the agent as a source chip. */
export const aiSourceSchema = z.object({
  id: z.number().int(),
  kind: z.enum(["canned_response", "resolved_ticket"]),
  sourceId: z.number().int(),
  ticketId: z.number().int().nullable(),
  title: z.string().nullable(),
  similarity: z.number(),
});
export type AiSource = z.infer<typeof aiSourceSchema>;

/**
 * The draft route streams `text/plain`: this object as a single JSON line first, then a newline,
 * then the draft text as it's generated. Only the leading line is schema-checked; the rest is prose.
 */
export const aiDraftResponseSchema = z.object({
  sources: z.array(aiSourceSchema),
  provider: z.enum(["groq", "gemini"]),
});
export type AiDraftResponse = z.infer<typeof aiDraftResponseSchema>;

export const aiTriageResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("suggestion"),
    category: ticketCategorySchema,
    priority: ticketPrioritySchema,
    confidence: z.number().min(0).max(1),
  }),
  // No suggestion: the ticket is past "new", or someone already set category/priority by hand.
  // `dismissed` is client-only: the agent waved the suggestion away for this session.
  z.object({ status: z.literal("skipped"), reason: z.enum(["not_new", "already_triaged", "dismissed"]) }),
]);
export type AiTriageResponse = z.infer<typeof aiTriageResponseSchema>;

export const aiSummaryResponseSchema = z.object({
  summary: z.string().min(1),
  messageCount: z.number().int(),
  includesInternalNotes: z.boolean(),
});
export type AiSummaryResponse = z.infer<typeof aiSummaryResponseSchema>;

// ---- Error envelope --------------------------------------------------------

export const okSchema = z.object({ ok: z.boolean() });

export const apiErrorSchema = z.object({
  error: z.enum(["invalid", "unauthorized", "forbidden", "not_found", "rate_limited", "unavailable", "generic"]),
  message: z.string().optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

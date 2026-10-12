import { Constants } from "@/lib/supabase/database.types";
import { z } from "zod";

// Request bodies are validated here, on the way in. Responses are not re-validated.

export const ticketStatusSchema = z.enum(Constants.public.Enums.ticket_status);
export const ticketPrioritySchema = z.enum(
  Constants.public.Enums.ticket_priority,
);
export const ticketCategorySchema = z.enum(
  Constants.public.Enums.ticket_category,
);

export const createTicketInputSchema = z.object({
  category: ticketCategorySchema,
  subject: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10_000),
  orderReference: z.string().trim().max(40).optional(),
});

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
    (v) =>
      v.status !== undefined ||
      v.priority !== undefined ||
      v.category !== undefined ||
      v.assignedAgentId !== undefined,
    {
      message:
        "At least one of status, priority, category or assignedAgentId is required",
    },
  );
export type UpdateTicketInput = z.infer<typeof updateTicketInputSchema>;

export const recordAttachmentInputSchema = z.object({
  messageId: z.number().int().nullable(),
  // `<ticketId>/<uuid>-<name>`; the route and a database check also bind it to this ticket.
  storagePath: z
    .string()
    .min(1)
    .max(400)
    .regex(/^\d+\/[\w.-]+$/),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
});

// A retrieved chunk the AI draft was built from, shown to the agent as a source chip.
export type AiSource = {
  id: number;
  kind: "canned_response" | "resolved_ticket";
  sourceId: number;
  ticketId: number | null;
  title: string | null;
  similarity: number;
};

export type ApiErrorBody = {
  error:
    | "invalid"
    | "unauthorized"
    | "forbidden"
    | "not_found"
    | "rate_limited"
    | "unavailable"
    | "generic";
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

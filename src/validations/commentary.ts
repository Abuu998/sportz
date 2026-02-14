import { z } from "zod";

export const listCommentaryQuerySchema = z.object({
  limit: z.number().int().positive().max(100).optional(),
});

export const createCommentarySchema = z.object({
  minute: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  period: z.string().min(1),
  eventType: z.string().min(1),
  actor: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  message: z.string().min(1, { message: "message is required" }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateCommentary = z.infer<typeof createCommentarySchema>;
export type ListCommentaryQuery = z.infer<typeof listCommentaryQuerySchema>;

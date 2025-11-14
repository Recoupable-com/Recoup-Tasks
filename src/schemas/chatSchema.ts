import { z } from "zod";

/**
 * Shared schema for chat configuration parameters.
 * Used across multiple tasks to ensure consistency.
 */
export const chatSchema = z.object({
  prompt: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  artistId: z.string().optional(),
  model: z.string().optional(),
});

export type ChatConfig = z.infer<typeof chatSchema>;

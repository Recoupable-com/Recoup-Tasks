import { z } from "zod";

/**
 * Default room ID used as fallback when roomId is not provided in the chat config.
 */
export const DEFAULT_ROOM_ID = "ceb9d9fc-7934-47d5-9021-124202cc1e70";

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

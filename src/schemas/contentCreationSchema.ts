import { z } from "zod";

export const createContentPayloadSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  artistSlug: z.string().min(1, "artistSlug is required"),
  template: z.string().min(1, "template is required"),
  lipsync: z.boolean().default(false),
  /** GitHub repo URL so the task can fetch artist files (face-guide, songs). */
  githubRepo: z.string().url("githubRepo must be a valid URL"),
});

export type CreateContentPayload = z.infer<typeof createContentPayloadSchema>;


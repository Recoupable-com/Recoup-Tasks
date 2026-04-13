import { z } from "zod";

export const CAPTION_LENGTHS = ["none", "short", "medium", "long"] as const;
export type CaptionLength = (typeof CAPTION_LENGTHS)[number];

export const createContentPayloadSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  artistSlug: z.string().min(1, "artistSlug is required"),
  template: z.string().min(1, "template is required"),
  lipsync: z.boolean().default(false),
  /** Controls caption text length: "none" skips captions, "short" (1-2 lines), "medium" (3-5 lines), "long" (paragraph). */
  captionLength: z.enum(CAPTION_LENGTHS).default("none"),
  /** Whether to upscale the image and video for higher quality. Adds ~2 min to pipeline. */
  upscale: z.boolean().default(false),
  /** GitHub repo URL so the task can fetch artist files (face-guide, songs). */
  githubRepo: z.string().url("githubRepo must be a valid URL"),
  /** Optional list of song slugs or public URLs. Slugs select from the artist's repo; URLs are downloaded directly. */
  songs: z.array(z.string()).optional(),
  /** Optional list of public image URLs to use as face guides instead of the artist's default face-guide.png. */
  images: z.array(z.string().url()).optional(),
});

export type CreateContentPayload = z.infer<typeof createContentPayloadSchema>;


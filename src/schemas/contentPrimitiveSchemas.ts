import { z } from "zod";

export const createImagePayloadSchema = z.object({
  accountId: z.string().min(1),
  template: z.string().min(1),
  artistSlug: z.string().min(1),
  githubRepo: z.string().url(),
  prompt: z.string().optional(),
  faceGuideUrl: z.string().url().optional(),
  images: z.array(z.string().url()).optional(),
});
export type CreateImagePayload = z.infer<typeof createImagePayloadSchema>;

export const createVideoPayloadSchema = z.object({
  accountId: z.string().min(1),
  imageUrl: z.string().url(),
  template: z.string().optional(),
  lipsync: z.boolean().default(false),
  songUrl: z.string().url().optional(),
  audioStartSeconds: z.number().optional(),
  audioDurationSeconds: z.number().optional(),
  motionPrompt: z.string().optional(),
});
export type CreateVideoPayload = z.infer<typeof createVideoPayloadSchema>;

export const createAudioPayloadSchema = z.object({
  accountId: z.string().min(1),
  githubRepo: z.string().url(),
  artistSlug: z.string().min(1),
  lipsync: z.boolean().default(false),
  songs: z.array(z.string()).optional(),
});
export type CreateAudioPayload = z.infer<typeof createAudioPayloadSchema>;

export const textStyleSchema = z.object({
  content: z.string().min(1),
  font: z.string().optional(),
  color: z.string().optional(),
  borderColor: z.string().optional(),
  maxFontSize: z.number().optional(),
});
export type TextStyle = z.infer<typeof textStyleSchema>;

export const createRenderPayloadSchema = z.object({
  accountId: z.string().min(1),
  videoUrl: z.string().url(),
  songUrl: z.string().url(),
  audioStartSeconds: z.number(),
  audioDurationSeconds: z.number(),
  text: textStyleSchema,
  hasAudio: z.boolean().default(false),
});
export type CreateRenderPayload = z.infer<typeof createRenderPayloadSchema>;

export const createUpscalePayloadSchema = z.object({
  accountId: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["image", "video"]),
});
export type CreateUpscalePayload = z.infer<typeof createUpscalePayloadSchema>;

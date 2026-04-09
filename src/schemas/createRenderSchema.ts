import { z } from "zod";

export const editOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trim"),
    start: z.number().nonnegative(),
    duration: z.number().positive(),
  }),
  z.object({
    type: z.literal("crop"),
    aspect: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().min(1),
    font: z.string().optional(),
    color: z.string().optional().default("white"),
    stroke_color: z.string().optional().default("black"),
    max_font_size: z.number().positive().optional().default(42),
    position: z.enum(["top", "center", "bottom"]).optional().default("bottom"),
  }),
  z.object({
    type: z.literal("mux_audio"),
    audio_url: z.string().url(),
    replace: z.boolean().optional().default(true),
  }),
]);

export const createRenderPayloadSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  video_url: z.string().url().optional(),
  audio_url: z.string().url().optional(),
  operations: z.array(editOperationSchema),
  output_format: z.enum(["mp4", "webm", "mov"]).default("mp4"),
});

export type CreateRenderPayload = z.infer<typeof createRenderPayloadSchema>;

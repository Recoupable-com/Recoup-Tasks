import { z } from "zod";

const cssColorRegex = /^[a-zA-Z]+$|^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const editOperationSchema = z.union([
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
  }).refine(data => data.aspect || data.width || data.height, {
    message: "crop requires at least one of: aspect, width, height",
  }),
  z.object({
    type: z.literal("resize"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).refine(data => data.width || data.height, {
    message: "resize requires at least one of: width, height",
  }),
  z.object({
    type: z.literal("overlay_text"),
    content: z.string().optional(),
    font: z.string().optional(),
    color: z.string().regex(cssColorRegex, "color must be a CSS color name or hex value").optional().default("white"),
    stroke_color: z.string().regex(cssColorRegex, "stroke_color must be a CSS color name or hex value").optional().default("black"),
    max_font_size: z.number().positive().optional().default(42),
    position: z.enum(["top", "center", "bottom"]).optional().default("bottom"),
  }),
]);

export const ffmpegEditPayloadSchema = z.object({
  accountId: z.string().min(1, "accountId is required"),
  video_url: z.string().url(),
  operations: z.array(editOperationSchema),
  output_format: z.enum(["mp4", "webm", "mov"]).default("mp4"),
});

export type FfmpegEditPayload = z.infer<typeof ffmpegEditPayloadSchema>;

/** @deprecated Use ffmpegEditPayloadSchema */
export const createRenderPayloadSchema = ffmpegEditPayloadSchema;
/** @deprecated Use FfmpegEditPayload */
export type CreateRenderPayload = FfmpegEditPayload;

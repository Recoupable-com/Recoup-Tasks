import { z } from "zod";

/**
 * Zod schema for the render-video task payload.
 *
 * Matches the RenderVideoPayload type sent by the API's
 * triggerRenderVideo() function (lib/trigger/triggerRenderVideo.ts).
 */
export const renderVideoPayloadSchema = z.object({
  compositionId: z.string().min(1, "compositionId is required"),
  inputProps: z.record(z.string(), z.unknown()).default({}),
  width: z.number().int().min(1).max(3840).default(720),
  height: z.number().int().min(1).max(3840).default(1280),
  fps: z.number().int().min(1).max(60).default(30),
  durationInFrames: z.number().int().min(1).max(1800).default(240),
  codec: z.enum(["h264", "h265", "vp8", "vp9"]).default("h264"),
  accountId: z.string().min(1, "accountId is required"),
});

export type RenderVideoPayload = z.infer<typeof renderVideoPayloadSchema>;

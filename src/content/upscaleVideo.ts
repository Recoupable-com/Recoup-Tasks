import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";

const VIDEO_UPSCALE_MODEL = "fal-ai/seedvr/upscale/video";
const TARGET_RESOLUTION = "1080p";

/**
 * Upscales a video from 720p to 1080p using fal.ai SeedVR2.
 * Matches the content-creation-app's upscaleVideo.ts behavior.
 *
 * @param videoUrl - URL of the video to upscale
 * @returns URL of the upscaled video
 */
export async function upscaleVideo(videoUrl: string): Promise<string> {
  logger.log("Upscaling video", {
    model: VIDEO_UPSCALE_MODEL,
    target: TARGET_RESOLUTION,
  });

  const result = await fal.subscribe(VIDEO_UPSCALE_MODEL, {
    input: {
      video_url: videoUrl,
      upscale_mode: "target",
      target_resolution: TARGET_RESOLUTION,
      noise_scale: 0.1,
      output_format: "X264 (.mp4)",
      output_quality: "high",
      output_write_mode: "balanced",
    },
    logs: true,
  });

  const data = result.data as Record<string, unknown>;
  const url = extractFalUrl(data);

  if (!url) {
    throw new Error(
      `Video upscale returned no URL. Response: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  logger.log("Video upscaled", { url: url.slice(0, 80) });
  return url;
}

/**
 *
 * @param data
 */
function extractFalUrl(data: Record<string, unknown>): string | undefined {
  for (const key of ["image", "video"]) {
    if (data[key] && typeof data[key] === "object") {
      const url = (data[key] as Record<string, string>)?.url;
      if (url) return url;
    }
  }
  for (const key of ["images", "videos"]) {
    if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
      const url = ((data[key] as unknown[])[0] as Record<string, string>)?.url;
      if (url) return url;
    }
  }
  if (typeof data.url === "string") return data.url;
  return undefined;
}

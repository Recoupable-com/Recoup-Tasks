import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";

/**
 * Generates a video from an AI-generated image using fal.ai image-to-video.
 *
 * @param imageUrl - URL of the source image (from generateContentImage)
 * @param motionPrompt - Describes how the subject should move
 * @returns URL of the generated video
 */
export async function generateContentVideo({
  imageUrl,
  motionPrompt,
}: {
  imageUrl: string;
  motionPrompt: string;
}): Promise<string> {
  const config = DEFAULT_PIPELINE_CONFIG;
  const durationSeconds = Math.min(
    config.clipDuration,
    config.videoModelMaxSeconds,
  );

  logger.log("Generating video", {
    model: config.videoModel,
    durationSeconds,
    motionPrompt: motionPrompt.slice(0, 100),
  });

  const result = await fal.subscribe(config.videoModel, {
    input: {
      prompt: motionPrompt,
      image_url: imageUrl,
      aspect_ratio: config.aspectRatio ?? "16:9",
      duration: `${durationSeconds}s`,
      resolution: config.videoResolution ?? "720p",
      generate_audio: false,
    },
    logs: true,
  });

  const data = result.data as Record<string, unknown>;
  const videoUrl = extractFalUrl(data);

  if (!videoUrl) {
    throw new Error(
      `Video generation returned no URL. Response: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  logger.log("Video generated", { videoUrl: videoUrl.slice(0, 80) });
  return videoUrl;
}

/**
 * Extracts a media URL from various fal.ai response shapes.
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

import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";

/**
 * Upscales an image using fal.ai SeedVR2 for realistic detail and texture.
 * Matches the content-creation-app's upscaleImage.ts behavior.
 *
 * @param imageUrl - URL of the image to upscale
 * @returns URL of the upscaled image
 */
export async function upscaleImage(imageUrl: string): Promise<string> {
  logger.log("Upscaling image", {
    model: DEFAULT_PIPELINE_CONFIG.upscaleModel,
  });

  const result = await fal.subscribe(DEFAULT_PIPELINE_CONFIG.upscaleModel, {
    input: {
      image_url: imageUrl,
      upscale_mode: "factor",
      upscale_factor: 2,
      output_format: "png",
    },
    logs: true,
  });

  const data = result.data as Record<string, unknown>;
  const url = extractFalUrl(data);

  if (!url) {
    throw new Error(
      `Image upscale returned no URL. Response: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  logger.log("Image upscaled", { url: url.slice(0, 80) });
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

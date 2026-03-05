import fs from "node:fs/promises";
import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";

/**
 * Generates an AI image of the artist using fal.ai.
 * Uses the face-guide as identity reference, a compositional reference image
 * for the scene layout, and a text prompt with style guide rules.
 *
 * @param faceGuideUrl - fal storage URL of the artist's face-guide image
 * @param referenceImagePath - local path to a template reference image (or null to skip)
 * @param prompt - Full scene/style prompt for image generation
 * @returns URL of the generated image
 */
export async function generateContentImage({
  faceGuideUrl,
  referenceImagePath,
  prompt,
}: {
  faceGuideUrl: string;
  referenceImagePath: string | null;
  prompt: string;
}): Promise<string> {
  const config = DEFAULT_PIPELINE_CONFIG;

  // Build image_urls array: always include face-guide, optionally add reference
  const imageUrls: string[] = [faceGuideUrl];

  if (referenceImagePath) {
    logger.log("Uploading reference image to fal storage", {
      path: referenceImagePath,
    });
    const refBuffer = await fs.readFile(referenceImagePath);
    const refFile = new File([refBuffer], "reference.png", { type: "image/png" });
    const refUrl = await fal.storage.upload(refFile);
    imageUrls.push(refUrl);
  }

  logger.log("Generating image", {
    model: config.imageModel,
    prompt: prompt.slice(0, 100),
    imageCount: imageUrls.length,
  });

  const result = await fal.subscribe(config.imageModel, {
    input: {
      prompt,
      image_urls: imageUrls,
      aspect_ratio: config.aspectRatio as "16:9",
      resolution: config.resolution as "2K",
      output_format: "png",
      num_images: 1,
    },
    logs: true,
  });

  const data = result.data as Record<string, unknown>;
  const imageUrl = extractFalUrl(data);

  if (!imageUrl) {
    throw new Error(
      `Image generation returned no URL. Response: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  logger.log("Image generated", { imageUrl: imageUrl.slice(0, 80) });
  return imageUrl;
}

/** Extracts a media URL from various fal.ai response shapes. */
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

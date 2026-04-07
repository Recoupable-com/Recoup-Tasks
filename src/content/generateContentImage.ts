import fs from "node:fs/promises";
import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";
import { falSubscribe } from "./falSubscribe";

/**
 * Generates an AI image using fal.ai.
 *
 * Takes up to two images:
 *   1. Guide image (face-guide headshot or album cover) — the primary subject
 *   2. Reference image (scene composition from template) — the setting
 *
 * The prompt tells the model how to combine these images.
 *
 * @param faceGuideUrl - fal storage URL of the guide image (face or album cover)
 * @param referenceImagePath - local path to a template reference image (or null)
 * @param prompt - Scene/style prompt with instructions for how to use the images
 * @returns URL of the generated image
 */
export async function generateContentImage({
  faceGuideUrl,
  referenceImagePath,
  prompt,
  additionalImageUrls,
}: {
  /** Guide image URL — omit for templates that don't use an input image. */
  faceGuideUrl?: string;
  referenceImagePath: string | null;
  prompt: string;
  /** Extra image URLs (e.g. album covers, playlist covers) to pass to the model. */
  additionalImageUrls?: string[];
}): Promise<string> {
  const config = DEFAULT_PIPELINE_CONFIG;

  // Build image_urls: guide image (if provided) + reference image (if provided)
  const imageUrls: string[] = [];
  if (faceGuideUrl) imageUrls.push(faceGuideUrl);

  if (referenceImagePath) {
    logger.log("Uploading reference image to fal storage", {
      path: referenceImagePath,
    });
    const refBuffer = await fs.readFile(referenceImagePath);
    const refFile = new File([refBuffer], "reference.png", { type: "image/png" });
    const refUrl = await fal.storage.upload(refFile);
    imageUrls.push(refUrl);
  }

  if (additionalImageUrls?.length) {
    const deduped = additionalImageUrls.filter((url) => !imageUrls.includes(url));
    logger.log("Adding additional image URLs", {
      count: deduped.length,
      urls: deduped.map((u) => u.slice(0, 80)),
    });
    imageUrls.push(...deduped);
  }

  logStep("Generating image", false, {
    model: config.imageModel,
    promptLength: prompt.length,
    imageCount: imageUrls.length,
    hasFaceGuide: Boolean(faceGuideUrl),
    hasReferenceImage: Boolean(referenceImagePath),
    hasAdditionalImages: Boolean(additionalImageUrls?.length),
  });

  const result = await falSubscribe(config.imageModel, {
    prompt,
    image_urls: imageUrls,
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution,
    output_format: "png",
    num_images: 1,
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

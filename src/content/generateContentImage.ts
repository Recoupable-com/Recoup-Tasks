import fs from "node:fs/promises";
import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";

/**
 * Generates an AI image of the artist using fal.ai.
 *
 * Takes two images:
 *   1. Face-guide (headshot on white/plain background) — the artist's identity
 *   2. Reference image (composition with a different person) — the scene/setting
 *
 * The prompt tells the model to replace the person in the reference scene
 * with the person from the face-guide headshot.
 *
 * @param faceGuideUrl - fal storage URL of the artist's face-guide (headshot)
 * @param referenceImagePath - local path to a template reference image (or null)
 * @param prompt - Scene/style prompt that instructs the face swap
 * @returns URL of the generated image
 */
export async function generateContentImage({
  faceGuideUrl,
  referenceImagePath,
  prompt,
}: {
  /** Face-guide URL — omit for templates that don't use the artist's face. */
  faceGuideUrl?: string;
  referenceImagePath: string | null;
  prompt: string;
}): Promise<string> {
  const config = DEFAULT_PIPELINE_CONFIG;

  // Build image_urls: face-guide (if provided) + reference image (if provided)
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

  const input = {
    prompt,
    image_urls: imageUrls,
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution,
    output_format: "png",
    num_images: 1,
  };

  logger.log("Generating image", {
    model: config.imageModel,
    promptLength: prompt.length,
    imageCount: imageUrls.length,
    hasFaceGuide: Boolean(faceGuideUrl),
    hasReferenceImage: Boolean(referenceImagePath),
  });

  let result;
  try {
    result = await fal.subscribe(config.imageModel, { input, logs: true });
  } catch (error: unknown) {
    const err = error as Record<string, unknown>;
    let body: string;
    try {
      body = JSON.stringify(err.body ?? err).slice(0, 1000);
    } catch {
      body = String(err).slice(0, 1000);
    }
    logger.error("fal.ai image generation failed", {
      model: config.imageModel,
      status: err.status,
      message: err.message,
      body,
      promptLength: prompt.length,
    });
    throw error;
  }

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

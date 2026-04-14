import { randomUUID } from "node:crypto";
import { unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logStep } from "../sandboxes/logStep";
import { buildStaticImageArgs } from "./buildStaticImageArgs";
import { downloadOverlayImages } from "./downloadOverlayImages";
import { downloadMediaToFile } from "./downloadMediaToFile";
import { runFfmpeg } from "./runFfmpeg";
import { uploadToFalStorage } from "./uploadToFalStorage";

export interface RenderStaticImageInput {
  imageUrl: string;
  overlayImageUrls: string[];
}

export interface RenderStaticImageOutput {
  imageUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Renders a static image by cropping to 9:16, scaling to 720×1280,
 * and overlaying playlist cover images. Uploads the result to fal.ai storage.
 */
export async function renderStaticImage(
  input: RenderStaticImageInput,
): Promise<RenderStaticImageOutput> {
  const tempDir = join(tmpdir(), `content-static-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const imagePath = join(tempDir, "base-image.png");
  const outputPath = join(tempDir, "static-image.png");
  let overlayPaths: string[] = [];

  try {
    logStep("Downloading base image for static render");
    await downloadMediaToFile(input.imageUrl, imagePath);

    overlayPaths = await downloadOverlayImages(input.overlayImageUrls, tempDir);

    const ffmpegArgs = buildStaticImageArgs({
      imagePath,
      overlayImagePaths: overlayPaths,
      outputPath,
    });

    logStep("Running ffmpeg static image render", true, {
      overlayCount: overlayPaths.length,
    });

    await runFfmpeg(ffmpegArgs);

    logStep("Static image rendered, uploading to fal.ai storage");
    const result = await uploadToFalStorage(outputPath, "static-image.png", "image/png");
    logStep("Static image uploaded", false, { imageUrl: result.url, sizeBytes: result.sizeBytes });

    return { imageUrl: result.url, mimeType: result.mimeType, sizeBytes: result.sizeBytes };
  } finally {
    const cleanupPaths = [imagePath, outputPath, ...overlayPaths];
    await Promise.all(cleanupPaths.map(p => unlink(p).catch(() => undefined)));
  }
}

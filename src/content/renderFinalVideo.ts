import { randomUUID } from "node:crypto";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logStep } from "../sandboxes/logStep";
import { buildFfmpegArgs } from "./buildFfmpegArgs";
import { calculateCaptionLayout } from "./calculateCaptionLayout";
import { stripEmoji } from "./stripEmoji";
import { downloadOverlayImages } from "./downloadOverlayImages";
import { downloadMediaToFile } from "./downloadMediaToFile";
import type { OverlayPosition } from "./overlayPosition";
import { runFfmpeg } from "./runFfmpeg";
import { uploadToFalStorage } from "./uploadToFalStorage";

export interface RenderFinalVideoInput {
  videoUrl: string;
  songBuffer: Buffer;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  captionText: string;
  hasAudio: boolean;
  overlayImageUrls?: string[];
  overlayPosition?: OverlayPosition;
}

export interface RenderFinalVideoOutput {
  videoUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Renders the final social post video using ffmpeg:
 * crops 16:9 → 9:16, overlays audio + captions + images, uploads to fal.ai storage.
 */
export async function renderFinalVideo(
  input: RenderFinalVideoInput,
): Promise<RenderFinalVideoOutput> {
  const tempDir = join(tmpdir(), `content-render-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const videoPath = join(tempDir, "input-video.mp4");
  const audioPath = join(tempDir, "song.mp3");
  const outputPath = join(tempDir, "final.mp4");
  let overlayPaths: string[] = [];

  try {
    logStep("Downloading video for final render");
    await downloadMediaToFile(input.videoUrl, videoPath);
    await writeFile(audioPath, input.songBuffer);

    overlayPaths = await downloadOverlayImages(input.overlayImageUrls ?? [], tempDir);

    const cleanCaption = stripEmoji(input.captionText);
    const captionLayout = calculateCaptionLayout(cleanCaption);

    const ffmpegArgs = buildFfmpegArgs({
      videoPath,
      audioPath,
      captionLayout,
      outputPath,
      audioStartSeconds: input.audioStartSeconds,
      audioDurationSeconds: input.audioDurationSeconds,
      hasAudio: input.hasAudio,
      overlayImagePaths: overlayPaths,
      overlayPosition: input.overlayPosition,
    });

    logStep("Running ffmpeg render", true, {
      hasAudio: input.hasAudio,
      overlayCount: overlayPaths.length,
    });

    await runFfmpeg(ffmpegArgs);

    logStep("Final video rendered, uploading to fal.ai storage");
    const result = await uploadToFalStorage(outputPath, "final-video.mp4", "video/mp4");
    logStep("Final video uploaded to fal.ai storage", false, { videoUrl: result.url, sizeBytes: result.sizeBytes });

    return { videoUrl: result.url, mimeType: result.mimeType, sizeBytes: result.sizeBytes };
  } finally {
    const cleanupPaths = [videoPath, audioPath, outputPath, ...overlayPaths];
    await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => undefined)));
  }
}

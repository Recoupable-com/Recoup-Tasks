import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { logStep } from "../sandboxes/logStep";
import { fal } from "@fal-ai/client";
import { buildFfmpegArgs } from "./buildFfmpegArgs";
import { calculateCaptionLayout } from "./calculateCaptionLayout";
import { stripEmoji } from "./stripEmoji";
import { downloadOverlayImages } from "./downloadOverlayImages";

const execFileAsync = promisify(execFile);

export interface RenderFinalVideoInput {
  videoUrl: string;
  songBuffer: Buffer;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  captionText: string;
  hasAudio: boolean;
  overlayImageUrls?: string[];
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
    const videoResponse = await fetch(input.videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    await writeFile(videoPath, Buffer.from(await videoResponse.arrayBuffer()));
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
    });

    logStep("Running ffmpeg render", true, {
      hasAudio: input.hasAudio,
      overlayCount: overlayPaths.length,
    });

    await execFileAsync("ffmpeg", ffmpegArgs);

    const finalBuffer = await readFile(outputPath);
    const sizeBytes = finalBuffer.length;
    logStep("Final video rendered, uploading to fal.ai storage", true, { sizeBytes });

    const videoFile = new File([finalBuffer], "final-video.mp4", { type: "video/mp4" });
    const videoUrl = await fal.storage.upload(videoFile);
    logStep("Final video uploaded to fal.ai storage", false, { videoUrl, sizeBytes });

    return { videoUrl, mimeType: "video/mp4", sizeBytes };
  } finally {
    const cleanupPaths = [videoPath, audioPath, outputPath, ...overlayPaths];
    await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => undefined)));
  }
}

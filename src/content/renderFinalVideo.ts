import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { logStep } from "../sandboxes/logStep";
import { fal } from "@fal-ai/client";
import { buildFfmpegArgs, calculateCaptionLayout, cleanCaptionText } from "./buildFfmpegArgs";
import { downloadOverlayImages } from "./downloadOverlayImages";

const execFileAsync = promisify(execFile);

export interface RenderFinalVideoInput {
  /** URL of the AI-generated video (16:9) */
  videoUrl: string;
  /** Raw mp3 bytes of the song */
  songBuffer: Buffer;
  /** Start time in the song to begin the audio clip (seconds) */
  audioStartSeconds: number;
  /** Duration of the clip (seconds) */
  audioDurationSeconds: number;
  /** Caption text to overlay on the video */
  captionText: string;
  /** Whether the video already has audio baked in (lipsync mode) */
  hasAudio: boolean;
  /** Optional image URLs to overlay on the video (playlist covers, logos) */
  overlayImageUrls?: string[];
}

export interface RenderFinalVideoOutput {
  /** Data URL of the final rendered video */
  dataUrl: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  sizeBytes: number;
}

/**
 * Renders the final social post video using ffmpeg:
 *   1. Downloads the AI-generated video
 *   2. Crops 16:9 → 9:16 (portrait for TikTok/Reels)
 *   3. Overlays audio clip from the song (unless lipsync mode)
 *   4. Overlays caption text (white with black stroke, bottom center)
 *   5. Returns the final video as a data URL
 */
export async function renderFinalVideo(
  input: RenderFinalVideoInput,
): Promise<RenderFinalVideoOutput> {
  const tempDir = join(tmpdir(), `content-render-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  const videoPath = join(tempDir, "input-video.mp4");
  const audioPath = join(tempDir, "song.mp3");
  const captionPath = join(tempDir, "caption.txt");
  const outputPath = join(tempDir, "final.mp4");

  let overlayPaths: string[] = [];

  try {
    // Download the AI-generated video
    logStep("Downloading video for final render");
    const videoResponse = await fetch(input.videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await writeFile(videoPath, videoBuffer);

    // Write the song mp3 to disk
    await writeFile(audioPath, input.songBuffer);

    // Download overlay images to temp files (if any)
    overlayPaths = await downloadOverlayImages(
      input.overlayImageUrls ?? [],
      tempDir,
    );

    // Calculate adaptive caption layout (auto-shrinks font for long text)
    const cleanCaption = cleanCaptionText(input.captionText);
    const captionLayout = calculateCaptionLayout(cleanCaption);

    // Build ffmpeg command
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
      argCount: ffmpegArgs.length,
      hasAudio: input.hasAudio,
      captionLength: input.captionText.length,
      overlayCount: overlayPaths.length,
    });

    await execFileAsync("ffmpeg", ffmpegArgs);

    // Read the final video and upload to fal.ai storage (avoids base64 OOM)
    const finalBuffer = await readFile(outputPath);
    const sizeBytes = finalBuffer.length;

    logStep("Final video rendered, uploading to fal.ai storage", true, { sizeBytes });

    const videoFile = new File([finalBuffer], "final-video.mp4", { type: "video/mp4" });
    const videoUrl = await fal.storage.upload(videoFile);

    logStep("Final video uploaded to fal.ai storage", false, { videoUrl, sizeBytes });

    return {
      videoUrl,
      mimeType: "video/mp4",
      sizeBytes,
    };
  } finally {
    // Clean up temp files (including overlay images)
    const cleanupPaths = [videoPath, audioPath, captionPath, outputPath, ...overlayPaths];
    await Promise.all(cleanupPaths.map((p) => unlink(p).catch(() => undefined)));
  }
}

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "@trigger.dev/sdk/v3";

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
  const outputPath = join(tempDir, "final.mp4");

  try {
    // Download the AI-generated video
    logger.log("Downloading video for final render");
    const videoResponse = await fetch(input.videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }
    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
    await writeFile(videoPath, videoBuffer);

    // Write the song mp3 to disk
    await writeFile(audioPath, input.songBuffer);

    // Build ffmpeg command
    const ffmpegArgs = buildFfmpegArgs({
      videoPath,
      audioPath,
      outputPath,
      audioStartSeconds: input.audioStartSeconds,
      audioDurationSeconds: input.audioDurationSeconds,
      captionText: input.captionText,
      hasAudio: input.hasAudio,
    });

    logger.log("Running ffmpeg render", {
      argCount: ffmpegArgs.length,
      hasAudio: input.hasAudio,
      captionLength: input.captionText.length,
    });

    await execFileAsync("ffmpeg", ffmpegArgs);

    // Read the final video
    const finalBuffer = await readFile(outputPath);
    const mimeType = "video/mp4";
    const dataUrl = `data:${mimeType};base64,${finalBuffer.toString("base64")}`;

    logger.log("Final video rendered", { sizeBytes: finalBuffer.length });

    return {
      dataUrl,
      mimeType,
      sizeBytes: finalBuffer.length,
    };
  } finally {
    // Clean up temp files
    await Promise.all([
      unlink(videoPath).catch(() => undefined),
      unlink(audioPath).catch(() => undefined),
      unlink(outputPath).catch(() => undefined),
    ]);
  }
}

/**
 * Builds the ffmpeg arguments for the final render.
 *
 * What it does (matching Remotion SocialPost):
 *   1. Center-crop 16:9 → 9:16 portrait
 *   2. Overlay audio from song clip (skip if lipsync — audio already in video)
 *   3. Overlay caption text (white, black stroke, bottom center)
 */
function buildFfmpegArgs({
  videoPath,
  audioPath,
  outputPath,
  audioStartSeconds,
  audioDurationSeconds,
  captionText,
  hasAudio,
}: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  captionText: string;
  hasAudio: boolean;
}): string[] {
  // Escape special characters in caption for ffmpeg drawtext
  const escapedCaption = captionText
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "'\\''")
    .replace(/:/g, "\\:")
    .replace(/%/g, "%%");

  // Video filter: crop 16:9 → 9:16 (center crop) + scale to 720x1280 + caption overlay
  const cropFilter = "crop=ih*9/16:ih";
  const scaleFilter = "scale=720:1280";
  const captionFilter = [
    `drawtext=text='${escapedCaption}'`,
    "fontsize=46",
    "fontcolor=white",
    "borderw=4",
    "bordercolor=black",
    "x=(w-tw)/2",
    "y=h*0.78",
    "line_spacing=10",
  ].join(":");

  const videoFilter = `${cropFilter},${scaleFilter},${captionFilter}`;

  const args = ["-y"];

  if (hasAudio) {
    // Lipsync mode: video already has audio, just crop + caption
    args.push(
      "-i", videoPath,
      "-vf", videoFilter,
      "-c:v", "libx264",
      "-c:a", "aac",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-shortest",
      outputPath,
    );
  } else {
    // Normal mode: crop video + overlay song audio clip
    args.push(
      "-i", videoPath,
      "-ss", String(audioStartSeconds),
      "-t", String(audioDurationSeconds),
      "-i", audioPath,
      "-vf", videoFilter,
      "-c:v", "libx264",
      "-c:a", "aac",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-shortest",
      outputPath,
    );
  }

  return args;
}

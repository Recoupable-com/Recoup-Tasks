import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "@trigger.dev/sdk/v3";
import { fal } from "@fal-ai/client";

const execFileAsync = promisify(execFile);

/**
 * Strips emoji and other non-ASCII characters that ffmpeg drawtext can't render.
 */
function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Wraps text to fit within a max character width per line.
 * Breaks on word boundaries to avoid mid-word splits.
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/** Video frame dimensions */
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;
/** Maximum portion of the frame height captions can use (40%) */
const MAX_CAPTION_HEIGHT_RATIO = 0.4;
/** Minimum font size — below this the text is unreadable */
const MIN_FONT_SIZE = 20;
/** Maximum font size */
const MAX_FONT_SIZE = 42;
/** Bottom margin from the frame edge */
const BOTTOM_MARGIN = 120;

/**
 * Calculates the optimal font size, line layout, and vertical position
 * so captions never get cut off regardless of text length.
 *
 * Vertical positioning:
 *   - Short (1-3 lines): bottom of frame
 *   - Medium (4-6 lines): vertically centered
 *   - Long (7+ lines): starts from top area
 *
 * Font auto-shrinks if text doesn't fit within the available space.
 */
function calculateCaptionLayout(text: string): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  /** "bottom" | "center" | "top" — determines where captions are placed */
  position: "bottom" | "center" | "top";
} {
  const maxHeight = FRAME_HEIGHT * MAX_CAPTION_HEIGHT_RATIO;

  let chosenLines: string[] = [];
  let chosenFontSize = MIN_FONT_SIZE;
  let chosenLineHeight = MIN_FONT_SIZE + 10;

  for (let fontSize = MAX_FONT_SIZE; fontSize >= MIN_FONT_SIZE; fontSize -= 2) {
    const charsPerLine = Math.floor(FRAME_WIDTH * 0.85 / (fontSize * 0.55));
    const lineHeight = fontSize + 10;
    const lines = wrapText(text, charsPerLine);
    const totalHeight = lines.length * lineHeight;

    if (totalHeight <= maxHeight) {
      chosenLines = lines;
      chosenFontSize = fontSize;
      chosenLineHeight = lineHeight;
      break;
    }
    chosenLines = lines;
    chosenFontSize = fontSize;
    chosenLineHeight = lineHeight;
  }

  // Determine position based on line count
  let position: "bottom" | "center" | "top";
  if (chosenLines.length <= 3) {
    position = "bottom";
  } else if (chosenLines.length <= 6) {
    position = "center";
  } else {
    position = "top";
  }

  return { lines: chosenLines, fontSize: chosenFontSize, lineHeight: chosenLineHeight, position };
}

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
  const captionPath = join(tempDir, "caption.txt");
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

    // Calculate adaptive caption layout (auto-shrinks font for long text)
    const cleanCaption = stripEmoji(input.captionText);
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
    });

    logger.log("Running ffmpeg render", {
      argCount: ffmpegArgs.length,
      hasAudio: input.hasAudio,
      captionLength: input.captionText.length,
    });

    await execFileAsync("ffmpeg", ffmpegArgs);

    // Read the final video and upload to fal.ai storage (avoids base64 OOM)
    const finalBuffer = await readFile(outputPath);
    const sizeBytes = finalBuffer.length;

    logger.log("Final video rendered, uploading to fal.ai storage", { sizeBytes });

    const videoFile = new File([finalBuffer], "final-video.mp4", { type: "video/mp4" });
    const videoUrl = await fal.storage.upload(videoFile);

    logger.log("Final video uploaded to fal.ai storage", { videoUrl, sizeBytes });

    return {
      videoUrl,
      mimeType: "video/mp4",
      sizeBytes,
    };
  } finally {
    // Clean up temp files
    await Promise.all([
      unlink(videoPath).catch(() => undefined),
      unlink(audioPath).catch(() => undefined),
      unlink(captionPath).catch(() => undefined),
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
  captionLayout,
  outputPath,
  audioStartSeconds,
  audioDurationSeconds,
  hasAudio,
}: {
  videoPath: string;
  audioPath: string;
  captionLayout: { lines: string[]; fontSize: number; lineHeight: number; position: "bottom" | "center" | "top" };
  outputPath: string;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  hasAudio: boolean;
}): string[] {
  const { lines, fontSize, lineHeight, position } = captionLayout;

  // Video filter: crop 16:9 → 9:16 (center crop) + scale to 720x1280 + caption lines
  // Each line is a separate drawtext filter, centered horizontally, stacked from bottom
  const cropFilter = "crop=ih*9/16:ih";
  const scaleFilter = "scale=720:1280";

  const totalTextHeight = lines.length * lineHeight;
  const borderWidth = Math.max(2, Math.round(fontSize / 14));

  // Calculate the Y start based on position strategy
  // "bottom" → text block sits near the bottom
  // "center" → text block is vertically centered
  // "top"    → text block starts near the top
  let blockStartY: number;
  if (position === "bottom") {
    blockStartY = FRAME_HEIGHT - BOTTOM_MARGIN - totalTextHeight;
  } else if (position === "center") {
    blockStartY = Math.round((FRAME_HEIGHT - totalTextHeight) / 2);
  } else {
    // "top" — start from upper area with some top margin
    blockStartY = 180;
  }

  // Build a drawtext filter for each line, centered horizontally
  const captionFilters = lines.map((line, i) => {
    // Escape ffmpeg drawtext special characters
    const escaped = line
      .replace(/\\/g, "\\\\\\\\")
      .replace(/'/g, "\u2019") // replace apostrophe with curly quote
      .replace(/:/g, "\\\\:")
      .replace(/%/g, "%%%%")
      .replace(/\n/g, " ")
      .replace(/\r/g, "");

    const yPos = blockStartY + (i * lineHeight);

    return [
      `drawtext=text='${escaped}'`,
      `fontsize=${fontSize}`,
      "fontcolor=white",
      `borderw=${borderWidth}`,
      "bordercolor=black",
      "x=(w-tw)/2",
      `y=${String(yPos)}`,
    ].join(":");
  });

  const videoFilter = [cropFilter, scaleFilter, ...captionFilters].join(",");

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

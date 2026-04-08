import { buildFilterComplex } from "./buildFilterComplex";
import { escapeDrawtext } from "./escapeDrawtext";

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
export function calculateCaptionLayout(text: string): {
  lines: string[];
  fontSize: number;
  lineHeight: number;
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

/**
 * Cleans caption text for ffmpeg drawtext (strips emoji and non-ASCII).
 */
export function cleanCaptionText(text: string): string {
  return stripEmoji(text);
}

/**
 * Builds the ffmpeg arguments for the final render.
 *
 * What it does (matching Remotion SocialPost):
 *   1. Center-crop 16:9 → 9:16 portrait
 *   2. Overlay audio from song clip (skip if lipsync — audio already in video)
 *   3. Overlay caption text (white, black stroke, bottom center)
 */
export function buildFfmpegArgs({
  videoPath,
  audioPath,
  captionLayout,
  outputPath,
  audioStartSeconds,
  audioDurationSeconds,
  hasAudio,
  overlayImagePaths,
}: {
  videoPath: string;
  audioPath: string;
  captionLayout: { lines: string[]; fontSize: number; lineHeight: number; position: "bottom" | "center" | "top" };
  outputPath: string;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  hasAudio: boolean;
  overlayImagePaths: string[];
}): string[] {
  const { lines, fontSize, lineHeight, position } = captionLayout;

  const cropFilter = "crop=ih*9/16:ih";
  const scaleFilter = "scale=720:1280";

  const totalTextHeight = lines.length * lineHeight;
  const borderWidth = Math.max(2, Math.round(fontSize / 14));

  let blockStartY: number;
  if (position === "bottom") {
    blockStartY = FRAME_HEIGHT - BOTTOM_MARGIN - totalTextHeight;
  } else if (position === "center") {
    blockStartY = Math.round((FRAME_HEIGHT - totalTextHeight) / 2);
  } else {
    blockStartY = 180;
  }

  const captionFilters = lines.map((line, i) => {
    const escaped = escapeDrawtext(line);

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

  const hasOverlays = overlayImagePaths.length > 0;

  const args = ["-y"];

  if (hasOverlays) {
    const audioInputIndex = hasAudio ? -1 : 1 + overlayImagePaths.length;

    args.push("-i", videoPath);
    for (const p of overlayImagePaths) {
      args.push("-i", p);
    }
    if (!hasAudio) {
      args.push("-ss", String(audioStartSeconds), "-t", String(audioDurationSeconds));
      args.push("-i", audioPath);
    }

    const filterComplex = buildFilterComplex({
      overlayCount: overlayImagePaths.length,
      captionFilters,
    });

    args.push("-filter_complex", filterComplex);
    args.push("-map", "[out]");

    if (hasAudio) {
      args.push("-map", "0:a");
      args.push("-c:a", "aac");
    } else {
      args.push("-map", `${audioInputIndex}:a:0`);
      args.push("-c:a", "aac");
    }

    args.push(
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-shortest",
      outputPath,
    );
  } else {
    const videoFilter = [cropFilter, scaleFilter, ...captionFilters].join(",");

    if (hasAudio) {
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
  }

  return args;
}

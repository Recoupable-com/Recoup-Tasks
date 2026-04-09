import { escapeDrawtext } from "./escapeDrawtext";
import { stripEmoji } from "./stripEmoji";
import type { FfmpegEditPayload } from "../schemas/ffmpegEditSchema";

type Operations = FfmpegEditPayload["operations"];

/**
 * Builds ffmpeg arguments from a list of video edit operations.
 *
 * Each operation maps to ffmpeg flags:
 *   - trim → -ss / -t
 *   - crop → crop= filter
 *   - resize → scale= filter
 *   - overlay_text → drawtext= filter
 *
 * @param inputPath - Path to the input video file.
 * @param outputPath - Path for the output file.
 * @param operations - Array of edit operations to apply in order.
 * @returns Array of ffmpeg CLI arguments.
 */
export function buildRenderFfmpegArgs(
  inputPath: string,
  outputPath: string,
  operations: Operations,
): string[] {
  const args = ["-y", "-i", inputPath];
  const videoFilters: string[] = [];

  for (const op of operations) {
    switch (op.type) {
      case "trim":
        args.splice(1, 0, "-ss", String(op.start), "-t", String(op.duration));
        break;
      case "crop":
        videoFilters.push(buildCropFilter(op));
        break;
      case "resize":
        videoFilters.push(`scale=${op.width ?? -1}:${op.height ?? -1}`);
        break;
      case "overlay_text":
        if (op.content) videoFilters.push(buildOverlayTextFilter(op));
        break;
    }
  }

  if (videoFilters.length > 0) {
    args.push("-vf", videoFilters.join(","));
  }

  args.push(
    "-c:v", "libx264",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-shortest",
    outputPath,
  );

  return args;
}

/**
 * Build the ffmpeg crop= filter from aspect ratio or explicit dimensions.
 *
 * For aspect ratio: calculates which dimension to constrain.
 *   - 9:16 (portrait): keep full height, narrow width → crop=ih*9/16:ih
 *   - 16:9 (landscape): keep full width, narrow height → crop=iw:iw*9/16
 */
function buildCropFilter(op: { aspect?: string; width?: number; height?: number }): string {
  if (op.aspect) {
    const [w, h] = op.aspect.split(":").map(Number);
    if (w && h) {
      return w >= h ? `crop=iw:iw*${h}/${w}` : `crop=ih*${w}/${h}:ih`;
    }
  }
  return `crop=${op.width ?? -1}:${op.height ?? -1}`;
}

/**
 * Build the ffmpeg drawtext= filter for text overlay.
 */
function buildOverlayTextFilter(op: {
  content: string;
  color: string;
  stroke_color: string;
  max_font_size: number;
  position: "top" | "center" | "bottom";
}): string {
  const cleanText = stripEmoji(op.content);
  const escaped = escapeDrawtext(cleanText);
  const safeColor = op.color.replace(/:/g, "\\\\:");
  const safeStrokeColor = op.stroke_color.replace(/:/g, "\\\\:");
  const borderWidth = Math.max(2, Math.round(op.max_font_size / 14));
  const yExpr =
    op.position === "top" ? "y=180" :
    op.position === "center" ? "y=(h-th)/2" :
    "y=h-th-120";

  return [
    `drawtext=text='${escaped}'`,
    `fontsize=${op.max_font_size}`,
    `fontcolor=${safeColor}`,
    `borderw=${borderWidth}`,
    `bordercolor=${safeStrokeColor}`,
    "x=(w-tw)/2",
    yExpr,
  ].join(":");
}

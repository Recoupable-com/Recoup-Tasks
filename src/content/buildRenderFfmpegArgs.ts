import type { FfmpegEditPayload } from "../schemas/ffmpegEditSchema";
import { buildCropFilter } from "./buildCropFilter";
import { buildOverlayTextFilter } from "./buildOverlayTextFilter";

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
      case "crop": {
        const filter = buildCropFilter(op);
        if (filter) videoFilters.push(filter);
        break;
      }
      case "resize":
        videoFilters.push(`scale=${op.width ?? -1}:${op.height ?? -1}`);
        break;
      case "overlay_text":
        if (op.content) videoFilters.push(buildOverlayTextFilter(op as Parameters<typeof buildOverlayTextFilter>[0]));
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

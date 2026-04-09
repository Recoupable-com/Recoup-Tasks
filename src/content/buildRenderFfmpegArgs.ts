import { escapeDrawtext } from "./escapeDrawtext";
import { stripEmoji } from "./stripEmoji";
import type { CreateRenderPayload } from "../schemas/createRenderSchema";

type Operations = CreateRenderPayload["operations"];

/**
 * Builds ffmpeg arguments from a list of edit operations.
 *
 * Reuses escapeDrawtext and stripEmoji from the content pipeline for
 * text processing. Each operation maps to ffmpeg flags:
 *   - trim → -ss / -t
 *   - crop → crop= filter
 *   - resize → scale= filter
 *   - overlay_text → drawtext= filter
 *   - mux_audio → extra -i + -map
 *
 * @param inputPath - Path to the input media file.
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
  const extraInputs: string[] = [];
  let audioMapping: string[] = [];

  for (const op of operations) {
    switch (op.type) {
      case "trim":
        args.splice(1, 0, "-ss", String(op.start), "-t", String(op.duration));
        break;

      case "crop":
        if (op.aspect) {
          const [w, h] = op.aspect.split(":").map(Number);
          if (w && h) {
            videoFilters.push(w > h ? `crop=ih*${w}/${h}:ih` : `crop=iw:iw*${h}/${w}`);
          }
        } else if (op.width || op.height) {
          videoFilters.push(`crop=${op.width ?? -1}:${op.height ?? -1}`);
        }
        break;

      case "resize":
        videoFilters.push(`scale=${op.width ?? -1}:${op.height ?? -1}`);
        break;

      case "overlay_text": {
        const cleanText = stripEmoji(op.content);
        const escaped = escapeDrawtext(cleanText);
        const borderWidth = Math.max(2, Math.round(op.max_font_size / 14));
        const yExpr =
          op.position === "top" ? "y=180" :
          op.position === "center" ? "y=(h-th)/2" :
          "y=h-th-120";

        videoFilters.push(
          [
            `drawtext=text='${escaped}'`,
            `fontsize=${op.max_font_size}`,
            `fontcolor=${op.color}`,
            `borderw=${borderWidth}`,
            `bordercolor=${op.stroke_color}`,
            "x=(w-tw)/2",
            yExpr,
          ].join(":"),
        );
        break;
      }

      case "mux_audio":
        extraInputs.push("-i", op.audio_url);
        audioMapping = op.replace
          ? ["-map", "0:v:0", "-map", "1:a:0"]
          : ["-map", "0:v:0", "-filter_complex", "amix=inputs=2", "-map", "0:a", "-map", "1:a"];
        break;
    }
  }

  if (videoFilters.length > 0) {
    args.push("-vf", videoFilters.join(","));
  }

  args.push(...extraInputs);

  if (audioMapping.length > 0) {
    args.push(...audioMapping);
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

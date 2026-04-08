import { buildFilterComplex } from "./buildFilterComplex";
import { escapeDrawtext } from "./escapeDrawtext";

/** Video frame dimensions */
const FRAME_HEIGHT = 1280;
/** Bottom margin from the frame edge */
const BOTTOM_MARGIN = 120;

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

/** Overlay image size */
const OVERLAY_SIZE = 250;
const EDGE_PADDING = 30;
const OVERLAY_GAP = 20;

/**
 * Builds ffmpeg arguments to render a static image with overlay images.
 *
 * Pipeline: crop 16:9 → 9:16, scale to 720×1280, overlay images top-left stacked vertically.
 * Outputs a single PNG frame.
 */
export function buildStaticImageArgs({
  imagePath,
  overlayImagePaths,
  outputPath,
}: {
  imagePath: string;
  overlayImagePaths: string[];
  outputPath: string;
}): string[] {
  const hasOverlays = overlayImagePaths.length > 0;
  const args = ["-y"];

  if (hasOverlays) {
    args.push("-i", imagePath);
    for (const p of overlayImagePaths) {
      args.push("-i", p);
    }

    const parts: string[] = [];

    // Crop + scale base image
    parts.push("[0:v]crop=ih*9/16:ih,scale=720:1280[img_base]");

    // Scale each overlay
    for (let i = 0; i < overlayImagePaths.length; i++) {
      parts.push(`[${1 + i}:v]scale=${OVERLAY_SIZE}:${OVERLAY_SIZE}[ovr_${i}]`);
    }

    // Chain overlays — stacked vertically from top-left
    let prevLabel = "img_base";
    for (let i = 0; i < overlayImagePaths.length; i++) {
      const x = EDGE_PADDING;
      const y = EDGE_PADDING + i * (OVERLAY_SIZE + OVERLAY_GAP);
      const outLabel = i < overlayImagePaths.length - 1 ? `ovr_out_${i}` : "out";
      parts.push(`[${prevLabel}][ovr_${i}]overlay=${x}:${y}[${outLabel}]`);
      prevLabel = outLabel;
    }

    args.push("-filter_complex", parts.join(";"));
    args.push("-map", "[out]");
    args.push("-frames:v", "1", outputPath);
  } else {
    args.push(
      "-i", imagePath,
      "-vf", "crop=ih*9/16:ih,scale=720:1280",
      "-frames:v", "1",
      outputPath,
    );
  }

  return args;
}

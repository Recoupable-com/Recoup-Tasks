import { calculateOverlayCoordinates, type OverlayPosition } from "./overlayPosition";

/** Overlay image size */
const OVERLAY_SIZE = 150;

/**
 * Builds the ffmpeg filter_complex string for video with overlay images and captions.
 *
 * Pipeline: crop → scale → overlay images → drawtext captions
 *
 * @param overlayCount - Number of overlay image inputs (starting at input index 1)
 * @param captionFilters - Array of drawtext filter strings for captions
 * @param overlayPosition - Corner to place overlays (default: top-left)
 * @returns The complete filter_complex string
 */
export function buildFilterComplex({
  overlayCount,
  captionFilters,
  overlayPosition = "top-left",
}: {
  overlayCount: number;
  captionFilters: string[];
  overlayPosition?: OverlayPosition;
}): string {
  const parts: string[] = [];

  // Crop + scale video
  parts.push("[0:v]crop=ih*9/16:ih,scale=720:1280[video_base]");

  // Scale each overlay input
  for (let i = 0; i < overlayCount; i++) {
    const inputIdx = 1 + i;
    parts.push(`[${inputIdx}:v]scale=${OVERLAY_SIZE}:${OVERLAY_SIZE}[ovr_${i}]`);
  }

  // Chain overlays at the chosen position
  let prevLabel = "video_base";
  for (let i = 0; i < overlayCount; i++) {
    const { x, y } = calculateOverlayCoordinates(overlayPosition, i, OVERLAY_SIZE);
    const outLabel = i < overlayCount - 1 ? `ovr_out_${i}` : "ovr_final";
    parts.push(`[${prevLabel}][ovr_${i}]overlay=${x}:${y}[${outLabel}]`);
    prevLabel = outLabel;
  }

  // Apply captions on overlay result (or alias to [out] if no captions)
  if (captionFilters.length > 0) {
    parts.push(`[ovr_final]${captionFilters.join(",")}[out]`);
  } else {
    parts.push("[ovr_final]copy[out]");
  }

  return parts.join(";");
}

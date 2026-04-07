/** Video frame dimensions (must match renderFinalVideo) */
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;

/** Size of each overlay image (square, with rounded corners applied separately) */
const OVERLAY_SIZE = 150;

/** Padding from the edge of the frame */
const EDGE_PADDING = 30;

/** Gap between stacked overlays */
const OVERLAY_GAP = 20;

export interface OverlayFiltersResult {
  /** ffmpeg input args (e.g. ["-i", "/tmp/cover1.png", "-i", "/tmp/cover2.png"]) */
  inputs: string[];
  /** ffmpeg filter_complex chain for scaling and overlaying images */
  filterChain: string;
}

/**
 * Builds ffmpeg input args and filter chain to overlay images onto a video.
 *
 * Images are scaled to a fixed size and stacked vertically in the bottom-right
 * corner of the frame, above the caption area.
 *
 * @param overlayImagePaths - Local file paths of images to overlay
 * @returns ffmpeg inputs and filter chain string
 */
export function buildOverlayFilters(overlayImagePaths: string[]): OverlayFiltersResult {
  if (overlayImagePaths.length === 0) {
    return { inputs: [], filterChain: "" };
  }

  const inputs: string[] = [];
  const filters: string[] = [];

  // Input 0 is video, input 1 is audio (when present).
  // Overlay inputs start after existing inputs — the caller must provide the correct offset.
  // We use placeholder indices [OVR0], [OVR1], etc. that the caller maps to actual input indices.

  for (let i = 0; i < overlayImagePaths.length; i++) {
    inputs.push("-i", overlayImagePaths[i]);

    // Scale overlay image to fixed size
    filters.push(`[ovr_in_${i}]scale=${OVERLAY_SIZE}:${OVERLAY_SIZE}[ovr_${i}]`);
  }

  // Chain overlays onto the video — stacked vertically from bottom-right
  // First overlay goes onto [video], producing [tmp0]. Second onto [tmp0], producing [tmp1], etc.
  let prevLabel = "video_base";
  for (let i = 0; i < overlayImagePaths.length; i++) {
    const x = FRAME_WIDTH - OVERLAY_SIZE - EDGE_PADDING;
    const yFromBottom = EDGE_PADDING + i * (OVERLAY_SIZE + OVERLAY_GAP);
    const y = FRAME_HEIGHT - OVERLAY_SIZE - 160 - yFromBottom; // 160 = above caption area
    const outLabel = i < overlayImagePaths.length - 1 ? `ovr_out_${i}` : "ovr_final";
    filters.push(`[${prevLabel}][ovr_${i}]overlay=${x}:${y}[${outLabel}]`);
    prevLabel = outLabel;
  }

  return { inputs, filterChain: filters.join(";") };
}

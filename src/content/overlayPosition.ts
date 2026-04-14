/** Supported overlay positions on the 9:16 frame. */
export const OVERLAY_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

/** Video frame dimensions */
const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;

/** Default overlay image size */
export const DEFAULT_OVERLAY_SIZE = 250;
const EDGE_PADDING = 30;
const OVERLAY_GAP = 20;

/**
 * Calculates x,y coordinates for an overlay image at the given position.
 *
 * Overlays stack vertically from the chosen corner:
 * - top-left / top-right: first overlay nearest the top, subsequent ones below
 * - bottom-left / bottom-right: first overlay nearest the bottom, subsequent ones above
 */
export function calculateOverlayCoordinates(
  position: OverlayPosition,
  index: number,
  overlaySize: number = DEFAULT_OVERLAY_SIZE,
): { x: number; y: number } {
  const isRight = position === "top-right" || position === "bottom-right";
  const isBottom = position === "bottom-left" || position === "bottom-right";

  const x = isRight ? FRAME_WIDTH - EDGE_PADDING - overlaySize : EDGE_PADDING;

  const y = isBottom
    ? FRAME_HEIGHT - EDGE_PADDING - overlaySize - index * (overlaySize + OVERLAY_GAP)
    : EDGE_PADDING + index * (overlaySize + OVERLAY_GAP);

  return { x, y };
}

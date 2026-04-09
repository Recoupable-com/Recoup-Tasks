import { escapeDrawtext } from "./escapeDrawtext";
import { stripEmoji } from "./stripEmoji";

/**
 * Build the ffmpeg drawtext= filter for text overlay.
 *
 * @param op - Overlay text operation with content, color, position, etc.
 * @returns The ffmpeg drawtext filter string.
 */
export function buildOverlayTextFilter(op: {
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

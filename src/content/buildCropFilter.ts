/**
 * Build the ffmpeg crop= filter from aspect ratio or explicit dimensions.
 *
 * For aspect ratio: calculates which dimension to constrain.
 *   - 9:16 (portrait): keep full height, narrow width → crop=ih*9/16:ih
 *   - 16:9 (landscape): keep full width, narrow height → crop=iw:iw*9/16
 *
 * @param op - Crop operation with aspect, width, or height.
 * @returns The ffmpeg crop filter string, or null if the input is invalid.
 */
export function buildCropFilter(op: { aspect?: string; width?: number; height?: number }): string | null {
  if (op.aspect) {
    const parts = op.aspect.split(":");
    if (parts.length !== 2) return null;
    const [w, h] = parts.map(Number);
    if (!w || !h || isNaN(w) || isNaN(h)) return null;
    return w >= h ? `crop=iw:iw*${h}/${w}` : `crop=ih*${w}/${h}:ih`;
  }
  if (op.width || op.height) {
    return `crop=${op.width ?? -1}:${op.height ?? -1}`;
  }
  return null;
}

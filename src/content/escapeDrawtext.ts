/**
 * Escapes a text string for use in ffmpeg drawtext filters.
 *
 * Handles both -vf and filter_complex contexts by replacing all
 * quote-like characters with the modifier letter apostrophe (U+02BC),
 * which renders identically but is not parsed as a delimiter by ffmpeg.
 *
 * @param text - Raw caption text
 * @returns Escaped text safe for ffmpeg drawtext
 */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\\/g, "\\\\\\\\")
    .replace(/['\u2018\u2019\u2032]/g, "\u02BC")
    .replace(/:/g, "\\\\:")
    .replace(/%/g, "%%%%");
}

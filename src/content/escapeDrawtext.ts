/**
 * Escapes a text string for use in ffmpeg drawtext filters.
 *
 * Handles both -vf and filter_complex contexts by replacing all
 * quote-like characters with the right single quotation mark (U+2019),
 * which renders as an apostrophe in all standard fonts and is not
 * parsed as a delimiter by ffmpeg.
 *
 * @param text - Raw caption text
 * @returns Escaped text safe for ffmpeg drawtext
 */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\\/g, "\\\\\\\\")
    .replace(/['\u2018\u2032]/g, "\u2019")
    .replace(/:/g, "\\\\:")
    .replace(/%/g, "%%");
}

/**
 * Escapes a text string for use in ffmpeg drawtext filters.
 *
 * Handles both -vf and filter_complex contexts by removing all
 * quote-like characters entirely. This is safe because captions
 * read naturally without apostrophes (e.g. "youre" instead of "you're").
 *
 * @param text - Raw caption text
 * @returns Escaped text safe for ffmpeg drawtext
 */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\\/g, "\\\\\\\\")
    .replace(/['\u2018\u2019\u2032]/g, "")
    .replace(/:/g, "\\\\:")
    .replace(/%/g, "%%");
}

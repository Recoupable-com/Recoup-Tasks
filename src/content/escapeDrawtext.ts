/**
 * Escapes a text string for use in ffmpeg drawtext filters.
 *
 * Handles both -vf and filter_complex contexts by removing all
 * characters that could break ffmpeg's parser: quotes, emoji,
 * and escaping colons/backslashes/percent signs.
 *
 * @param text - Raw caption text
 * @returns Escaped text safe for ffmpeg drawtext
 */
export function escapeDrawtext(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/\\/g, "\\\\\\\\")
    .replace(/['\u2018\u2019\u2032""\u201C\u201D]/g, "")
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/:/g, "\\\\:")
    .replace(/%/g, "%%")
    .replace(/\s{2,}/g, " ")
    .trim();
}

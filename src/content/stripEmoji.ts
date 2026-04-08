/**
 * Strips emoji and other non-ASCII characters that ffmpeg drawtext can't render.
 */
export function stripEmoji(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

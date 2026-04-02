import type { SongClip } from "./analyzeClips";
import type { SongLyrics } from "./transcribeSong";

/**
 * Ranks clips by word density and relatability.
 *
 * Word density = number of lyric segments that fall within the clip window,
 * divided by the clip duration. Higher density means more words per second.
 *
 * Relatability is an optional 1-10 score from the LLM. When word densities
 * are similar, relatability breaks the tie.
 *
 * @param clips - Candidate clips from analyzeClips
 * @param lyrics - Timestamped lyrics from transcription
 * @param clipDuration - Duration of each clip in seconds
 * @param lipsync - When true, clips with lyrics are prioritized
 * @returns Clips sorted best-first (does not mutate the original array)
 */
export function rankClips(
  clips: SongClip[],
  lyrics: SongLyrics,
  clipDuration: number,
  lipsync?: boolean,
): SongClip[] {
  if (clips.length <= 1) return [...clips];

  const scored = clips.map(clip => {
    const clipEnd = clip.startSeconds + clipDuration;
    const wordsInWindow = lyrics.segments.filter(
      s => s.start < clipEnd && s.end > clip.startSeconds,
    ).length;
    const wordDensity = wordsInWindow / clipDuration;
    const relatability = (clip as SongClip & { relatability?: number }).relatability ?? 5;

    return { clip, wordDensity, relatability };
  });

  // Sort by combined score: word density (normalized to 0-10 range) + relatability (1-10)
  const maxDensity = Math.max(...scored.map(s => s.wordDensity), 0.001);

  scored.sort((a, b) => {
    const aHasLyrics = a.clip.hasLyrics !== false;
    const bHasLyrics = b.clip.hasLyrics !== false;

    // In lipsync mode, always prefer clips with lyrics
    if (lipsync && aHasLyrics !== bHasLyrics) {
      return aHasLyrics ? -1 : 1;
    }

    // Normalize word density to 0-10 scale, then combine with relatability
    const aScore = (a.wordDensity / maxDensity) * 10 + a.relatability;
    const bScore = (b.wordDensity / maxDensity) * 10 + b.relatability;
    return bScore - aScore;
  });

  return scored.map(s => s.clip);
}

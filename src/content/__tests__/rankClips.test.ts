import { describe, it, expect } from "vitest";
import { rankClips } from "../rankClips";
import type { SongClip } from "../analyzeClips";
import type { SongLyrics } from "../songLyricsTypes";

describe("rankClips", () => {
  const makeLyrics = (segments: Array<{ start: number; end: number; text: string }>): SongLyrics => ({
    title: "Test Song",
    fullLyrics: segments.map(s => s.text).join(" "),
    segments,
  });

  it("ranks clips with more words in the clip window higher", () => {
    const lyrics = makeLyrics([
      // Sparse section at 0-15s (3 words)
      { start: 0, end: 2, text: "oh" },
      { start: 4, end: 5, text: "yeah" },
      { start: 10, end: 11, text: "mmm" },
      // Dense section at 30-45s (8 words)
      { start: 30, end: 31, text: "I" },
      { start: 31, end: 32, text: "never" },
      { start: 32, end: 33, text: "thought" },
      { start: 33, end: 34, text: "that" },
      { start: 34, end: 35, text: "we" },
      { start: 35, end: 36, text: "would" },
      { start: 36, end: 37, text: "end" },
      { start: 37, end: 38, text: "up" },
    ]);

    const clips: SongClip[] = [
      { startSeconds: 0, lyrics: "oh yeah mmm", reason: "intro", mood: "chill", hasLyrics: true },
      { startSeconds: 30, lyrics: "I never thought that we would end up", reason: "hook", mood: "emotional", hasLyrics: true },
    ];

    const ranked = rankClips(clips, lyrics, 15);
    expect(ranked[0].startSeconds).toBe(30);
  });

  it("uses relatability score from LLM when word density is similar", () => {
    const lyrics = makeLyrics([
      { start: 0, end: 1, text: "word1" },
      { start: 1, end: 2, text: "word2" },
      { start: 2, end: 3, text: "word3" },
      { start: 3, end: 4, text: "word4" },
      { start: 20, end: 21, text: "word5" },
      { start: 21, end: 22, text: "word6" },
      { start: 22, end: 23, text: "word7" },
      { start: 23, end: 24, text: "word8" },
    ]);

    const clips: SongClip[] = [
      { startSeconds: 0, lyrics: "word1 word2 word3 word4", reason: "verse", mood: "flat", hasLyrics: true, relatability: 3 },
      { startSeconds: 20, lyrics: "word5 word6 word7 word8", reason: "chorus", mood: "hype", hasLyrics: true, relatability: 9 },
    ];

    const ranked = rankClips(clips, lyrics, 15);
    expect(ranked[0].startSeconds).toBe(20);
  });

  it("filters out clips without lyrics when lipsync is true", () => {
    const lyrics = makeLyrics([
      { start: 0, end: 1, text: "instrumental" },
      { start: 30, end: 31, text: "sing" },
      { start: 31, end: 32, text: "along" },
    ]);

    const clips: SongClip[] = [
      { startSeconds: 0, lyrics: "", reason: "beat drop", mood: "hype", hasLyrics: false },
      { startSeconds: 30, lyrics: "sing along", reason: "chorus", mood: "happy", hasLyrics: true },
    ];

    const ranked = rankClips(clips, lyrics, 15, true);
    expect(ranked[0].startSeconds).toBe(30);
    expect(ranked.length).toBe(2); // all clips returned, but lyrics-having ones first
  });

  it("returns clips unchanged when only one clip exists", () => {
    const lyrics = makeLyrics([{ start: 5, end: 6, text: "hello" }]);
    const clips: SongClip[] = [
      { startSeconds: 5, lyrics: "hello", reason: "only option", mood: "neutral", hasLyrics: true },
    ];

    const ranked = rankClips(clips, lyrics, 15);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].startSeconds).toBe(5);
  });

  it("counts actual words in multi-word segments, not just segment count", () => {
    // Two clips with the same number of overlapping segments (2 each),
    // but clipB has multi-word segments (8 words total) vs clipA (2 words).
    // Word density should favor clipB.
    const lyrics = makeLyrics([
      { start: 0, end: 2, text: "oh" },
      { start: 3, end: 5, text: "yeah" },
      { start: 30, end: 33, text: "I never thought that" },
      { start: 33, end: 36, text: "we would end up here" },
    ]);

    const clips: SongClip[] = [
      { startSeconds: 0, lyrics: "oh yeah", reason: "intro", mood: "chill", hasLyrics: true, relatability: 5 },
      { startSeconds: 30, lyrics: "I never thought that we would end up here", reason: "hook", mood: "emotional", hasLyrics: true, relatability: 5 },
    ];

    const ranked = rankClips(clips, lyrics, 15);
    // Both clips overlap 2 segments, but clipB has 9 words vs clipA's 2
    expect(ranked[0].startSeconds).toBe(30);
  });

  it("handles clips with no words in window gracefully", () => {
    const lyrics = makeLyrics([
      { start: 50, end: 51, text: "far away" },
    ]);

    const clips: SongClip[] = [
      { startSeconds: 0, lyrics: "", reason: "intro", mood: "quiet", hasLyrics: false },
      { startSeconds: 50, lyrics: "far away", reason: "bridge", mood: "sad", hasLyrics: true },
    ];

    const ranked = rankClips(clips, lyrics, 15);
    // Clip with actual words should rank higher
    expect(ranked[0].startSeconds).toBe(50);
  });
});

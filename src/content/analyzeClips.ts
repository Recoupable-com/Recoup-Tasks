import { ToolLoopAgent, stepCountIs } from "ai";
import { logStep } from "../sandboxes/logStep";
import type { SongLyrics } from "./transcribeSong";
import { parseSongClips } from "./parseSongClips";

export interface SongClip {
  startSeconds: number;
  lyrics: string;
  reason: string;
  mood: string;
  hasLyrics: boolean;
  relatability?: number;
}

/**
 * Analyzes a song's lyrics using a ToolLoopAgent + Google Gemini to find
 * the best clip moments for social content (TikTok/Reels).
 *
 * @param songTitle - Display title for the LLM prompt
 * @param lyrics - Timestamped lyrics from transcription
 * @returns Array of clip recommendations
 */
export async function analyzeClips(
  songTitle: string,
  lyrics: SongLyrics,
): Promise<SongClip[]> {
  const timestampedLyrics = lyrics.segments
    .map(s => `[${s.start.toFixed(1)}s] ${s.text}`)
    .join("\n");

  const prompt = `You are analyzing a song for social media content. Find the BEST MOMENTS in this song — the starting points where a clip would make great TikTok/Reels content regardless of clip length.

Song: "${songTitle}"

Timestamped lyrics:
${timestampedLyrics}

Find 3-5 moments. Each moment is a START TIME where something great begins — a hook, a chorus, an emotional lyric, a quotable line.

PRIORITIZE moments that have:
1. HIGH WORD DENSITY — sections packed with lyrics, not sparse intros or instrumental breaks. The more words per second, the better.
2. RELATABILITY — lyrics that listeners connect with emotionally. Universal feelings (love, heartbreak, ambition, struggle) beat abstract/niche references.
3. Standalone impact — the lyric works as a caption without context
4. Hooky — catchy melody at this part (hooks, choruses, title lines)
5. Quotable — something someone would screenshot or share

AVOID selecting:
- Song intros or outros with sparse/no lyrics
- Sections that are mostly ad-libs, "oh", "yeah", "mmm", or filler
- Instrumental breaks or transitions

Return ONLY a JSON array (no markdown, no code fences) with this format:
[
  {
    "startSeconds": 0,
    "lyrics": "the lyrics that start at this moment",
    "reason": "why this moment works for social content",
    "mood": "1-2 word mood description",
    "hasLyrics": true,
    "relatability": 8
  }
]

hasLyrics should be TRUE only if the clip contains actual sung words/lyrics. Set to FALSE if the section is mostly instrumental, humming, ooh/ahh, ad-libs, or music breaks.
relatability is a 1-10 score: 10 = universally relatable lyrics everyone connects with, 1 = niche/abstract.

IMPORTANT: startSeconds must align with actual word timestamps from the lyrics above. Don't invent timestamps.
IMPORTANT: Return the moments ranked by quality — best moment FIRST.`;

  logStep("Analyzing clips", true, { songTitle });

  const fallbackClip: SongClip = {
    startSeconds: 0,
    lyrics: lyrics.segments.slice(0, 10).map(s => s.text).join(" "),
    reason: "fallback — model error",
    mood: "unknown",
    hasLyrics: true,
  };

  let responseText: string;
  try {
    const agent = new ToolLoopAgent({
      model: "google/gemini-2.5-flash",
      stopWhen: stepCountIs(1),
    });
    const result = await agent.generate({ prompt });
    responseText = result.text.trim();
  } catch (error) {
    logStep("Clip analysis model error, using fallback", true, {
      error: String(error),
    });
    return [fallbackClip];
  }

  // Extract JSON array from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logStep("Could not parse clip analysis, using fallback", true, {
      responseText: responseText.slice(0, 200),
    });
    return [{ ...fallbackClip, reason: "fallback — start of song" }];
  }

  const clips = parseSongClips(jsonMatch[0]);
  if (clips.length === 0) {
    logStep("Failed to parse clip JSON, using fallback");
    return [{ ...fallbackClip, reason: "fallback — JSON parse failed" }];
  }

  logStep("Clip analysis complete", true, {
    songTitle,
    clipCount: clips.length,
  });

  return clips;
}

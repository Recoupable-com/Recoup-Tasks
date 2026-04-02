import { logStep } from "../sandboxes/logStep";
import { createClipAnalysisAgent } from "../agents/createClipAnalysisAgent";
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

  const prompt = `Song: "${songTitle}"

Timestamped lyrics:
${timestampedLyrics}`;

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
    const agent = createClipAnalysisAgent();
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

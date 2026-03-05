import { logger } from "@trigger.dev/sdk/v3";
import type { SongLyrics } from "./transcribeSong";

export interface SongClip {
  startSeconds: number;
  lyrics: string;
  reason: string;
  mood: string;
  hasLyrics: boolean;
}

/**
 * Analyzes a song's lyrics using the Recoup Chat API to find the best
 * clip moments for social content (TikTok/Reels).
 *
 * @param songTitle - Display title for the LLM prompt
 * @param lyrics - Timestamped lyrics from transcription
 * @returns Array of clip recommendations
 */
export async function analyzeClips(
  songTitle: string,
  lyrics: SongLyrics,
): Promise<SongClip[]> {
  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) {
    throw new Error("RECOUP_API_KEY is required for clip analysis");
  }

  const timestampedLyrics = lyrics.segments
    .map(s => `[${s.start.toFixed(1)}s] ${s.text}`)
    .join("\n");

  const prompt = `You are analyzing a song for social media content. Find the BEST MOMENTS in this song — the starting points where a clip would make great TikTok/Reels content regardless of clip length.

Song: "${songTitle}"

Timestamped lyrics:
${timestampedLyrics}

Find 3-5 moments. Each moment is a START TIME where something great begins — a hook, a chorus, an emotional lyric, a quotable line.

A great moment has:
- A lyric that works as a standalone caption (makes sense without the rest of the song)
- Emotional impact — makes someone stop scrolling
- Hooky — the melody is likely catchy at this part (hooks, choruses, title lines)
- Quotable — something someone would screenshot or share

Return ONLY a JSON array (no markdown, no code fences) with this format:
[
  {
    "startSeconds": 0,
    "lyrics": "the lyrics that start at this moment",
    "reason": "why this moment works for social content",
    "mood": "1-2 word mood description",
    "hasLyrics": true
  }
]

hasLyrics should be TRUE only if the clip contains actual sung words/lyrics. Set to FALSE if the section is mostly instrumental, humming, ooh/ahh, ad-libs, or music breaks.

IMPORTANT: startSeconds must align with actual word timestamps from the lyrics above. Don't invent timestamps.`;

  logger.log("Analyzing clips", { songTitle });

  const recoupApiUrl = process.env.RECOUP_API_URL ?? "https://recoup-api.vercel.app";
  const response = await fetch(`${recoupApiUrl}/api/chat/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": recoupApiKey,
    },
    body: JSON.stringify({
      prompt,
      model: "google/gemini-2.5-flash",
      excludeTools: ["create_task"],
    }),
  });

  if (!response.ok) {
    throw new Error(`Recoup Chat API error: ${response.status}`);
  }

  const json = (await response.json()) as {
    text?: string | Array<{ type: string; text?: string }>;
  };

  // Parse the polymorphic text field
  let responseText: string;
  if (typeof json.text === "string") {
    responseText = json.text.trim();
  } else if (Array.isArray(json.text)) {
    responseText = json.text
      .filter(p => p.type === "text" && p.text)
      .map(p => p.text!)
      .join("")
      .trim();
  } else {
    responseText = "";
  }

  // Extract JSON array from response
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    logger.log("Could not parse clip analysis, using fallback", {
      responseText: responseText.slice(0, 200),
    });
    return [
      {
        startSeconds: 0,
        lyrics: lyrics.segments.slice(0, 10).map(s => s.text).join(" "),
        reason: "fallback — start of song",
        mood: "unknown",
        hasLyrics: true,
      },
    ];
  }

  const clips = JSON.parse(jsonMatch[0]) as SongClip[];
  logger.log("Clip analysis complete", {
    songTitle,
    clipCount: clips.length,
  });

  return clips;
}

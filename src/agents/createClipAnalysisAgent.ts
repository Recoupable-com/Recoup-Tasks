import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

export const songClipSchema = z.object({
  startSeconds: z.number().nonnegative(),
  lyrics: z.string(),
  reason: z.string(),
  mood: z.string(),
  hasLyrics: z.boolean(),
  relatability: z.number().int().min(1).max(10).optional(),
});

export const songClipsSchema = z.array(songClipSchema);

const instructions = `You analyze songs for social media content. Given a song title and timestamped lyrics, find the BEST MOMENTS — starting points where a clip would make great TikTok/Reels content regardless of clip length.

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

hasLyrics should be TRUE only if the clip contains actual sung words/lyrics. Set to FALSE if the section is mostly instrumental, humming, ooh/ahh, ad-libs, or music breaks.
relatability is a 1-10 score: 10 = universally relatable lyrics everyone connects with, 1 = niche/abstract.

IMPORTANT: startSeconds must align with actual word timestamps from the lyrics provided. Don't invent timestamps.
IMPORTANT: Return the moments ranked by quality — best moment FIRST.`;

/**
 * Creates a ToolLoopAgent configured for analyzing song clips.
 * Uses Output.object with a Zod schema for structured, validated responses.
 *
 * @returns A configured ToolLoopAgent using Google Gemini via AI Gateway.
 */
export function createClipAnalysisAgent() {
  return new ToolLoopAgent({
    model: "google/gemini-2.5-flash",
    instructions,
    output: Output.object({ schema: songClipsSchema }),
    stopWhen: stepCountIs(1),
  });
}

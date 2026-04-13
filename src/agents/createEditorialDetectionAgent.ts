import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";

const editorialDetectionSchema = z.object({
  isEditorial: z.boolean(),
});

const instructions = `You classify images as editorial press photos or not.

An editorial press photo is a professionally styled portrait or press shot of an artist — the kind used in magazine features, Spotify editorial playlists, or artist profile pages. Key characteristics:
- Professional or cinematic lighting (not flat/amateur)
- The artist is the main subject, posed intentionally
- Clean background (solid, textured, or blurred environment)
- No text, overlays, branding, or graphics on the image
- Looks like it was taken by a professional photographer

These are NOT editorial press photos:
- Playlist covers or album art (often have text, logos, or heavy graphic design)
- Promotional graphics with text overlays or branding
- Headshots on plain white backgrounds (those are face guides, not editorial)
- Concert/live performance photos
- Casual selfies or low-quality phone photos
- Screenshots, collages, or composite images
- Logos, icons, or branded assets

Return isEditorial: true ONLY for professional editorial-style press photos.
Return isEditorial: false for everything else.`;

/**
 * Creates a ToolLoopAgent configured for editorial press photo detection.
 * Uses Output.object with a Zod schema for structured boolean response.
 *
 * @returns A configured ToolLoopAgent using Google Gemini via AI Gateway.
 */
export function createEditorialDetectionAgent() {
  return new ToolLoopAgent({
    model: "google/gemini-3.1-flash-lite-preview",
    instructions,
    output: Output.object({ schema: editorialDetectionSchema }),
    stopWhen: stepCountIs(1),
  });
}

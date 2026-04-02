import { z } from "zod";
import type { SongClip } from "./analyzeClips";

const SongClipSchema = z.object({
  startSeconds: z.coerce.number().nonnegative(),
  lyrics: z.string(),
  reason: z.string(),
  mood: z.string(),
  hasLyrics: z.boolean(),
  relatability: z.coerce.number().int().min(1).max(10).optional(),
});

const SongClipsSchema = z.array(SongClipSchema);

/**
 * Parses and validates a JSON string of song clips using Zod.
 * Filters out invalid clips and coerces string numbers.
 *
 * @param jsonString - Raw JSON string from LLM output
 * @returns Validated array of SongClip objects
 */
export function parseSongClips(jsonString: string): SongClip[] {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return [];
  }

  if (!Array.isArray(raw)) return [];

  // Validate each clip individually so one bad clip doesn't reject all
  return raw.reduce<SongClip[]>((acc, item) => {
    const result = SongClipSchema.safeParse(item);
    if (result.success) {
      acc.push(result.data);
    }
    return acc;
  }, []);
}

import { logger } from "@trigger.dev/sdk/v3";
import { parseSongPath } from "./listArtistSongs";

/**
 * Filters song paths to only include those matching the given slugs.
 * Uses exact slug matching against the directory name under /songs/.
 * Returns songPaths unmodified when songs is empty or undefined.
 *
 * @param songPaths - Encoded song paths from listArtistSongs
 * @param songs - Song slugs to keep (e.g. ["hiccups", "adhd"])
 * @param artistSlug - Artist slug (for error messages)
 * @returns Filtered song paths
 */
export function filterSongPaths(
  songPaths: string[],
  songs: string[] | undefined,
  artistSlug: string,
): string[] {
  if (!songs || songs.length === 0) return songPaths;

  const requested = new Set(songs.map(s => s.trim().toLowerCase()).filter(Boolean));

  const filtered = songPaths.filter(encodedPath => {
    const { filePath } = parseSongPath(encodedPath);
    const match = filePath.match(/\/songs\/([^/]+)\//);
    return !!match && requested.has(match[1].toLowerCase());
  });

  if (filtered.length === 0) {
    throw new Error(
      `None of the specified songs [${songs.join(", ")}] were found for artist ${artistSlug}`,
    );
  }

  logger.log("Filtered to specified songs", { songs, matchCount: filtered.length });
  return filtered;
}

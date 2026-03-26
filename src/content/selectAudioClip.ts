import { logger } from "@trigger.dev/sdk/v3";
import { listArtistSongs, parseSongPath } from "./listArtistSongs";
import { fetchGithubFile } from "./fetchGithubFile";
import { transcribeSong } from "./transcribeSong";
import { analyzeClips, type SongClip } from "./analyzeClips";
import type { SongLyrics } from "./transcribeSong";

export interface SelectedAudioClip {
  /** Original song filename */
  songFilename: string;
  /** Song title (derived from filename) */
  songTitle: string;
  /** Raw mp3 bytes of the full song */
  songBuffer: Buffer;
  /** Start time in seconds for the clip */
  startSeconds: number;
  /** Duration of the clip in seconds */
  durationSeconds: number;
  /** Full transcribed lyrics */
  lyrics: SongLyrics;
  /** Lyrics for the selected clip window */
  clipLyrics: string;
  /** Why this clip was picked */
  clipReason: string;
  /** Mood of the clip */
  clipMood: string;
}

/**
 * Selects the best audio clip for a content video.
 *
 * Flow:
 *   1. List mp3 files from GitHub repo
 *   2. Pick a random song
 *   3. Download the mp3
 *   4. Transcribe with fal.ai Whisper
 *   5. Analyze clips with Recoup Chat API
 *   6. Pick the best clip
 *
 * @param githubRepo - GitHub repo URL
 * @param artistSlug - Artist directory name
 * @param clipDuration - How long the clip should be (seconds)
 * @param lipsync - Whether to prefer clips with lyrics (for lipsync mode)
 * @returns Selected audio clip with all metadata
 */
export async function selectAudioClip({
  githubRepo,
  artistSlug,
  clipDuration,
  lipsync,
  songs,
}: {
  githubRepo: string;
  artistSlug: string;
  clipDuration: number;
  lipsync: boolean;
  songs?: string[];
}): Promise<SelectedAudioClip> {
  // Step 1: List available songs
  let songPaths = await listArtistSongs(githubRepo, artistSlug);
  if (songPaths.length === 0) {
    throw new Error(`No mp3 files found for artist ${artistSlug}`);
  }

  // Step 1b: Filter to allowed songs if specified
  if (songs && songs.length > 0) {
    songPaths = songPaths.filter(path =>
      songs.some(slug => path.includes(`/songs/${slug}`)),
    );
    if (songPaths.length === 0) {
      throw new Error(
        `None of the specified songs [${songs.join(", ")}] were found for artist ${artistSlug}`,
      );
    }
    logger.log("Filtered to specified songs", { songs, matchCount: songPaths.length });
  }

  // Step 2: Pick a random song
  const encodedPath = songPaths[Math.floor(Math.random() * songPaths.length)];
  const { repoUrl, filePath: songPath } = parseSongPath(encodedPath);
  const songFilename = songPath.split("/").pop() ?? "unknown.mp3";
  const songTitle = songFilename.replace(/\.mp3$/i, "");
  logger.log("Selected song", { songTitle, songPath });

  // Step 3: Download the mp3 (use org repo URL if the song was found there)
  const songBuffer = await fetchGithubFile(repoUrl ?? githubRepo, songPath);
  if (!songBuffer) {
    throw new Error(`Failed to download song: ${songPath}`);
  }

  // Step 4: Transcribe
  const lyrics = await transcribeSong(songBuffer, songFilename);

  // Step 5: Analyze clips
  const clips = await analyzeClips(songTitle, lyrics);

  // Step 6: Pick the best unused clip
  if (clips.length === 0) {
    // Fallback if analysis returned nothing
    clips.push({
      startSeconds: 0,
      lyrics: "",
      reason: "fallback — no clips analyzed",
      mood: "unknown",
      hasLyrics: true,
    });
  }

  let selectedClip: SongClip;
  if (lipsync) {
    const lyricsClips = clips.filter(c => c.hasLyrics !== false);
    selectedClip = lyricsClips.length > 0 ? lyricsClips[0] : clips[0];
  } else {
    selectedClip = clips[0];
  }

  // Get lyrics for the clip window
  const clipEnd = selectedClip.startSeconds + clipDuration;
  const clipSegments = lyrics.segments.filter(
    s => s.start < clipEnd && s.end > selectedClip.startSeconds,
  );
  const clipLyrics = clipSegments.map(s => s.text).join(" ");

  logger.log("Audio clip selected", {
    songTitle,
    startSeconds: selectedClip.startSeconds,
    clipLyrics: clipLyrics.slice(0, 80),
    mood: selectedClip.mood,
  });

  return {
    songFilename,
    songTitle,
    songBuffer,
    startSeconds: selectedClip.startSeconds,
    durationSeconds: clipDuration,
    lyrics,
    clipLyrics,
    clipReason: selectedClip.reason,
    clipMood: selectedClip.mood,
  };
}

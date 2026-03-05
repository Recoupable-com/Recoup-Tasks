import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";

export interface LyricSegment {
  start: number;
  end: number;
  text: string;
}

export interface SongLyrics {
  title: string;
  fullLyrics: string;
  segments: LyricSegment[];
}

/**
 * Transcribes a song using fal.ai Whisper.
 * Returns timestamped lyrics for clip analysis.
 *
 * @param songBuffer - Raw mp3 file bytes
 * @param songFilename - Original filename (e.g. "song-title.mp3")
 * @returns Timestamped lyrics with segments
 */
export async function transcribeSong(
  songBuffer: Buffer,
  songFilename: string,
): Promise<SongLyrics> {
  logger.log("Transcribing song", { filename: songFilename });

  // Upload audio to fal storage
  const file = new File([songBuffer], songFilename, { type: "audio/mpeg" });
  const audioUrl = await fal.storage.upload(file);

  // Transcribe with Whisper
  const result = await fal.subscribe("fal-ai/whisper" as string, {
    input: {
      audio_url: audioUrl,
      task: "transcribe",
      chunk_level: "word",
      language: "en",
    },
    logs: true,
  });

  const data = result.data as unknown as {
    text?: string;
    chunks?: Array<{ timestamp: number[]; text: string }>;
  };

  const lyrics: SongLyrics = {
    title: songFilename.replace(/\.mp3$/i, ""),
    fullLyrics: data.text ?? "",
    segments: (data.chunks ?? []).map(chunk => ({
      start: chunk.timestamp[0] ?? 0,
      end: chunk.timestamp[1] ?? 0,
      text: chunk.text?.trim() ?? "",
    })),
  };

  logger.log("Song transcribed", {
    title: lyrics.title,
    segmentCount: lyrics.segments.length,
    lyricsLength: lyrics.fullLyrics.length,
  });

  return lyrics;
}

/**
 * Gets the lyrics for a specific time range within a song.
 */
export function getLyricsForTimeRange(
  lyrics: SongLyrics,
  startSeconds: number,
  endSeconds: number,
): { clipLyrics: string; segments: LyricSegment[] } {
  const segments = lyrics.segments.filter(
    s => s.start < endSeconds && s.end > startSeconds,
  );
  const clipLyrics = segments.map(s => s.text).join(" ");
  return { clipLyrics, segments };
}

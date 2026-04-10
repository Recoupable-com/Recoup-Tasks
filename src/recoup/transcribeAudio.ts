import { callRecoupApi } from "./callRecoupApi";

export interface TranscribeResult {
  audioUrl: string;
  fullLyrics: string;
  segments: Array<{ start: number; end: number; text: string }>;
  segmentCount: number;
}

/**
 * Transcribe audio via POST /api/content/transcribe.
 *
 * @param audioUrl - Public URL of the audio file.
 * @returns Transcription with full lyrics and word-level segments.
 */
export async function transcribeAudio(audioUrl: string): Promise<TranscribeResult> {
  const data = await callRecoupApi("/api/content/transcribe", {
    audio_urls: [audioUrl],
    language: "en",
    chunk_level: "word",
  });
  return data as unknown as TranscribeResult;
}

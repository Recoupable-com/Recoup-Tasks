import { logStep } from "../sandboxes/logStep";
import { transcribeSong } from "./transcribeSong";
import { analyzeClips, type SongClip } from "./analyzeClips";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";
import type { SelectedAudioClip } from "./selectAudioClip";

/**
 * Selects an audio clip from a user-attached audio file URL.
 * Downloads the file, transcribes it, analyzes clips, and picks the best one.
 *
 * @param audioUrl - Public URL of the user-attached audio file
 * @param lipsync - Whether to prefer clips with lyrics (for lipsync mode)
 * @returns Selected audio clip with all metadata
 */
export async function selectAttachedAudioClip({
  audioUrl,
  lipsync,
}: {
  audioUrl: string;
  lipsync: boolean;
}): Promise<SelectedAudioClip> {
  const clipDuration = DEFAULT_PIPELINE_CONFIG.clipDuration;

  // Download the attached audio
  logStep("Downloading attached audio", { url: audioUrl });
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to download attached audio: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const songBuffer = Buffer.from(arrayBuffer);

  // Derive filename from URL (decode %20, replace spaces for fal.ai compat)
  const urlPath = new URL(audioUrl).pathname;
  const songFilename = decodeURIComponent(urlPath.split("/").pop() ?? "attached-audio.mp3").replace(/\s+/g, "-");
  const songTitle = songFilename.replace(/\.(mp3|wav|m4a|ogg|aac)$/i, "");

  logStep("Attached audio downloaded", { songTitle, sizeBytes: songBuffer.byteLength });

  // Transcribe
  const lyrics = await transcribeSong(songBuffer, songFilename);

  // Analyze clips
  const clips = await analyzeClips(songTitle, lyrics);

  if (clips.length === 0) {
    clips.push({
      startSeconds: 0,
      lyrics: "",
      reason: "fallback — no clips analyzed",
      mood: "unknown",
      hasLyrics: false,
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

  logStep("Attached audio clip selected", {
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

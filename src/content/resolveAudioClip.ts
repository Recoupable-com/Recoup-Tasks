import { logStep } from "../sandboxes/logStep";
import { selectAudioClip, type SelectedAudioClip } from "./selectAudioClip";
import { selectAttachedAudioClip } from "./selectAttachedAudioClip";
import type { CreateContentPayload } from "../schemas/contentCreationSchema";

/**
 * Resolves the audio clip for the content pipeline.
 * If any entry in songs is a URL, downloads and processes it directly.
 * Otherwise delegates to selectAudioClip to pick from the artist's repo.
 */
export async function resolveAudioClip(
  payload: Pick<CreateContentPayload, "songs" | "lipsync" | "githubRepo" | "artistSlug">,
): Promise<SelectedAudioClip> {
  const songUrl = payload.songs?.find(s => s.startsWith("http"));

  if (songUrl) {
    logStep("Using song URL from songs array");
    return selectAttachedAudioClip({ audioUrl: songUrl, lipsync: payload.lipsync });
  }

  logStep("Selecting audio clip from repo");
  return selectAudioClip(payload);
}

import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createAudioPayloadSchema } from "../schemas/contentPrimitiveSchemas";
import { logStep } from "../sandboxes/logStep";
import { resolveAudioClip } from "../content/resolveAudioClip";

export const createAudioTask = schemaTask({
  id: "create-audio",
  schema: createAudioPayloadSchema,
  maxDuration: 60 * 3,
  machine: "micro",
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    logStep("Selecting audio clip");
    const clip = await resolveAudioClip(payload);

    // Upload the song buffer to fal storage so callers can reference it
    const songFile = new File([clip.songBuffer], clip.songFilename, { type: "audio/mpeg" });
    const songUrl = await fal.storage.upload(songFile);

    logStep("Audio clip selected", true, {
      songTitle: clip.songTitle,
      startSeconds: clip.startSeconds,
      clipLyrics: clip.clipLyrics.slice(0, 80),
    });

    return {
      songTitle: clip.songTitle,
      songFilename: clip.songFilename,
      songUrl,
      startSeconds: clip.startSeconds,
      durationSeconds: clip.durationSeconds,
      fullLyrics: clip.lyrics.fullLyrics,
      clipLyrics: clip.clipLyrics,
      clipReason: clip.clipReason,
      clipMood: clip.clipMood,
    };
  },
});

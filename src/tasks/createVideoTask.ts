import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createVideoPayloadSchema } from "../schemas/contentPrimitiveSchemas";
import { logStep } from "../sandboxes/logStep";
import { generateContentVideo } from "../content/generateContentVideo";
import { generateAudioVideo } from "../content/generateAudioVideo";
import { loadTemplate, buildMotionPrompt } from "../content/loadTemplate";

export const createVideoTask = schemaTask({
  id: "create-video",
  schema: createVideoPayloadSchema,
  maxDuration: 60 * 5,
  machine: "micro",
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    let motionPrompt = payload.motionPrompt;
    if (!motionPrompt && payload.template) {
      const template = await loadTemplate(payload.template);
      motionPrompt = buildMotionPrompt(template);
    }
    motionPrompt = motionPrompt ?? "nearly still, only natural breathing";

    let videoUrl: string;

    if (payload.lipsync && payload.songUrl) {
      logStep("Generating audio-to-video (lipsync)");
      const songResponse = await fetch(payload.songUrl);
      if (!songResponse.ok) throw new Error(`Failed to download song: ${songResponse.status}`);
      const songBuffer = Buffer.from(await songResponse.arrayBuffer());

      videoUrl = await generateAudioVideo({
        imageUrl: payload.imageUrl,
        songBuffer,
        audioStartSeconds: payload.audioStartSeconds ?? 0,
        audioDurationSeconds: payload.audioDurationSeconds ?? 15,
        motionPrompt,
      });
    } else {
      logStep("Generating image-to-video");
      videoUrl = await generateContentVideo({
        imageUrl: payload.imageUrl,
        motionPrompt,
      });
    }

    logStep("Video generated", true, { videoUrl: videoUrl.slice(0, 60) });
    return { videoUrl };
  },
});

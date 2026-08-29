import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createRenderPayloadSchema } from "../schemas/contentPrimitiveSchemas";
import { logStep } from "../sandboxes/logStep";
import { renderFinalVideo } from "../content/renderFinalVideo";

export const createRenderTask = schemaTask({
  id: "create-render",
  schema: createRenderPayloadSchema,
  maxDuration: 60 * 2,
  machine: "medium-1x",
  retry: { maxAttempts: 0 },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);

    // Download the song from URL to get a Buffer
    logStep("Downloading song for render");
    const songResponse = await fetch(payload.songUrl);
    if (!songResponse.ok) throw new Error(`Failed to download song: ${songResponse.status}`);
    const songBuffer = Buffer.from(await songResponse.arrayBuffer());

    logStep("Rendering final video");
    const result = await renderFinalVideo({
      videoUrl: payload.videoUrl,
      songBuffer,
      audioStartSeconds: payload.audioStartSeconds,
      audioDurationSeconds: payload.audioDurationSeconds,
      captionText: payload.text.content,
      hasAudio: payload.hasAudio,
    });

    logStep("Render complete", true, { sizeBytes: result.sizeBytes });
    return { videoUrl: result.videoUrl, sizeBytes: result.sizeBytes };
  },
});

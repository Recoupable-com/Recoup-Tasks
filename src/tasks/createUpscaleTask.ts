import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createUpscalePayloadSchema } from "../schemas/contentPrimitiveSchemas";
import { logStep } from "../sandboxes/logStep";
import { upscaleImage } from "../content/upscaleImage";
import { upscaleVideo } from "../content/upscaleVideo";

export const createUpscaleTask = schemaTask({
  id: "create-upscale",
  schema: createUpscalePayloadSchema,
  maxDuration: 60 * 3,
  machine: "micro",
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    let url: string;
    if (payload.type === "image") {
      logStep("Upscaling image");
      url = await upscaleImage(payload.url);
    } else {
      logStep("Upscaling video");
      url = await upscaleVideo(payload.url);
    }

    logStep("Upscale complete", true, { url: url.slice(0, 60) });
    return { url };
  },
});

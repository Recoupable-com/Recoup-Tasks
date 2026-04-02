import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createImagePayloadSchema } from "../schemas/contentPrimitiveSchemas";
import { logStep } from "../sandboxes/logStep";
import { resolveFaceGuide } from "../content/resolveFaceGuide";
import { generateContentImage } from "../content/generateContentImage";
import {
  loadTemplate,
  pickRandomReferenceImage,
  buildImagePrompt,
} from "../content/loadTemplate";
import { resolveImageInstruction } from "../content/resolveImageInstruction";

export const createImageTask = schemaTask({
  id: "create-image",
  schema: createImagePayloadSchema,
  maxDuration: 60 * 2,
  machine: "micro",
  retry: { maxAttempts: 1 },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    logStep("Loading template for image generation");
    const template = await loadTemplate(payload.template);

    const faceGuideUrl = await resolveFaceGuide({
      usesFaceGuide: template.usesFaceGuide,
      images: payload.images,
      githubRepo: payload.githubRepo,
      artistSlug: payload.artistSlug,
    });

    const referenceImagePath = pickRandomReferenceImage(template);
    const instruction = resolveImageInstruction(template);
    const basePrompt = payload.prompt
      ? `${instruction} ${payload.prompt}`
      : `${instruction} ${template.imagePrompt}`;
    const fullPrompt = buildImagePrompt(basePrompt, template.styleGuide);

    logStep("Generating image");
    const imageUrl = await generateContentImage({
      faceGuideUrl: payload.faceGuideUrl ?? faceGuideUrl ?? undefined,
      referenceImagePath,
      prompt: fullPrompt,
    });

    logStep("Image generated", true, { imageUrl: imageUrl.slice(0, 60) });
    return { imageUrl };
  },
});

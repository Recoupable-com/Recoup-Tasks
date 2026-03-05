import { fal } from "@fal-ai/client";
import { logger, metadata, schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createContentPayloadSchema } from "../schemas/contentCreationSchema";
import { fetchGithubFile } from "../content/fetchGithubFile";
import { generateContentImage } from "../content/generateContentImage";
import { generateContentVideo } from "../content/generateContentVideo";
import {
  loadTemplate,
  pickRandomReferenceImage,
  buildImagePrompt,
  buildMotionPrompt,
} from "../content/loadTemplate";
import { DEFAULT_IMAGE_PROMPT } from "../content/contentPrompts";

/**
 * Content-creation task — generates a real AI video for an artist.
 *
 * Pipeline steps:
 *   1. Load template (style guide, reference images, moods)
 *   2. Fetch face-guide from artist's GitHub repo
 *   3. Upload face-guide to fal.ai storage
 *   4. Generate image (fal.ai — face-guide + reference + styled prompt)
 *   5. Generate video (fal.ai — animate the image with motion prompt)
 *   6. Return video URL for API to persist
 *
 * This task intentionally avoids direct Supabase access. Storage and
 * file-record writes are handled by the API layer.
 */
export const createContentTask = schemaTask({
  id: "create-content",
  schema: createContentPayloadSchema,
  maxDuration: 60 * 10,
  retry: {
    maxAttempts: 0,
  },
  run: async payload => {
    await tags.add(`account:${payload.accountId}`);
    metadata.set("currentStep", "Starting content pipeline");
    metadata.set("accountId", payload.accountId);
    metadata.set("artistSlug", payload.artistSlug);
    metadata.set("template", payload.template);
    metadata.set("lipsync", payload.lipsync);

    logger.log("create-content task started", payload);

    // --- Configure fal.ai client ---
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      throw new Error("FAL_KEY environment variable is required");
    }
    fal.config({ credentials: falKey });

    // --- Step 1: Load template ---
    metadata.set("currentStep", "Loading template");
    const template = await loadTemplate(payload.template);
    logger.log("Template loaded", {
      name: template.name,
      hasStyleGuide: !!template.styleGuide,
      referenceImages: template.referenceImagePaths.length,
      moods: template.videoMoods.length,
    });

    // --- Step 2: Fetch face-guide from GitHub ---
    metadata.set("currentStep", "Fetching face-guide from GitHub");
    const faceGuideBuffer = await fetchGithubFile(
      payload.githubRepo,
      `artists/${payload.artistSlug}/context/images/face-guide.png`,
    );
    if (!faceGuideBuffer) {
      throw new Error(
        `face-guide.png not found in repo for artist ${payload.artistSlug}`,
      );
    }

    // --- Step 3: Upload face-guide to fal storage ---
    metadata.set("currentStep", "Uploading face-guide to fal storage");
    const faceGuideFile = new File([faceGuideBuffer], "face-guide.png", {
      type: "image/png",
    });
    const faceGuideUrl = await fal.storage.upload(faceGuideFile);
    logger.log("Face-guide uploaded", { url: faceGuideUrl.slice(0, 80) });

    // --- Step 4: Generate image ---
    metadata.set("currentStep", "Generating image with fal.ai");
    const referenceImagePath = pickRandomReferenceImage(template);
    const fullPrompt = buildImagePrompt(DEFAULT_IMAGE_PROMPT, template.styleGuide);
    const imageUrl = await generateContentImage({
      faceGuideUrl,
      referenceImagePath,
      prompt: fullPrompt,
    });

    // --- Step 5: Generate video ---
    metadata.set("currentStep", "Generating video with fal.ai");
    const motionPrompt = buildMotionPrompt(template);
    const videoUrl = await generateContentVideo({
      imageUrl,
      motionPrompt,
    });

    // --- Return result for API to persist ---
    const result = {
      status: "completed",
      accountId: payload.accountId,
      artistSlug: payload.artistSlug,
      template: payload.template,
      lipsync: payload.lipsync,
      videoSourceUrl: videoUrl,
      imageUrl,
      renderedVideoBytes: null,
      video: null,
      message: "create-content task generated a real AI video",
    };

    metadata.set("currentStep", "Complete");
    logger.log("create-content task completed", {
      imageUrl: imageUrl.slice(0, 80),
      videoUrl: videoUrl.slice(0, 80),
    });
    return result;
  },
});

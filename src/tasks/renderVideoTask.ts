import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { renderVideoPayloadSchema } from "../schemas/renderVideoSchema";
import { uploadRenderedVideo } from "../supabase/uploadRenderedVideo";

/**
 * Background task that renders a Remotion video composition.
 *
 * Triggered by the API via POST /api/video/render.
 * The API returns the run ID immediately so callers can poll
 * GET /api/tasks/runs?runId=<runId> for status and the rendered video URL.
 *
 * This task:
 * 1. Bundles the Remotion project (src/remotion/index.ts)
 * 2. Selects the composition by ID
 * 3. Renders the video with the provided config (dimensions, fps, codec, inputProps)
 * 4. Uploads the .mp4 to Supabase Storage
 * 5. Returns the public video URL
 *
 * Works for ANY registered composition — SocialPost, CropPreview, or any future
 * composition added to src/remotion/Root.tsx.
 */
export const renderVideoTask = schemaTask({
  id: "render-video",
  schema: renderVideoPayloadSchema,
  maxDuration: 60 * 10, // 10 minutes max for video rendering
  machine: "large-1x", // Video rendering needs significant CPU/RAM
  retry: {
    maxAttempts: 1, // No retries — renders are expensive
  },
  run: async (payload) => {
    const {
      compositionId,
      inputProps,
      width,
      height,
      fps,
      durationInFrames,
      codec,
      accountId,
    } = payload;

    logger.log("Starting video render", {
      compositionId,
      width,
      height,
      fps,
      durationInFrames,
      codec,
      accountId,
    });

    metadata.set("currentStep", "Bundling Remotion project");
    metadata.set("compositionId", compositionId);
    metadata.set("accountId", accountId);

    // --- Step 1: Bundle the Remotion project ---
    // The entry point is the Remotion index.ts that calls registerRoot()
    // In the Trigger.dev container, additionalFiles places them relative to cwd (/app)
    const entryPoint = path.join(process.cwd(), "src", "remotion", "index.ts");
    const publicDir = path.join(process.cwd(), "src", "remotion", "public");

    logger.log("Bundling Remotion project", { entryPoint, publicDir });

    const bundleLocation = await bundle({
      entryPoint,
      // Only include publicDir if it exists (it contains fonts, etc.)
      publicDir: fs.existsSync(publicDir) ? publicDir : undefined,
    });

    logger.log("Bundle complete", { bundleLocation });

    // --- Step 2: Select the composition ---
    metadata.set("currentStep", "Selecting composition");

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps: inputProps as Record<string, unknown>,
    });

    // Override composition settings with the API-provided values
    composition.width = width;
    composition.height = height;
    composition.fps = fps;
    composition.durationInFrames = durationInFrames;

    logger.log("Composition selected", {
      id: composition.id,
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    });

    // --- Step 3: Render the video ---
    metadata.set("currentStep", "Rendering video");

    // Create a temp file for the output
    const tmpDir = os.tmpdir();
    const outputPath = path.join(
      tmpDir,
      `render-${compositionId}-${Date.now()}.mp4`
    );

    logger.log("Rendering video", { outputPath, codec });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec,
      outputLocation: outputPath,
      inputProps: inputProps as Record<string, unknown>,
      timeoutInMilliseconds: 120_000, // 2 minutes per frame (generous for slow machines)
    });

    logger.log("Render complete", { outputPath });

    // --- Step 4: Upload to Supabase Storage ---
    metadata.set("currentStep", "Uploading to storage");

    const { videoUrl, storageKey } = await uploadRenderedVideo(
      outputPath,
      accountId,
      compositionId
    );

    // Clean up the temp file
    try {
      fs.unlinkSync(outputPath);
    } catch {
      // Temp file cleanup is best-effort
    }

    // --- Step 5: Return the result ---
    metadata.set("currentStep", "Render complete");
    metadata.set("videoUrl", videoUrl);

    logger.log("Video render completed", {
      compositionId,
      accountId,
      videoUrl,
      storageKey,
    });

    return {
      compositionId,
      width,
      height,
      fps,
      durationInFrames,
      codec,
      accountId,
      videoUrl,
      storageKey,
    };
  },
});

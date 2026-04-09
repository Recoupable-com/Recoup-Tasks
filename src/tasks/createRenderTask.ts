import { randomUUID } from "node:crypto";
import { unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createRenderPayloadSchema } from "../schemas/createRenderSchema";
import { logStep } from "../sandboxes/logStep";
import { downloadMediaToFile } from "../content/downloadMediaToFile";
import { runFfmpeg } from "../content/runFfmpeg";
import { uploadToFalStorage } from "../content/uploadToFalStorage";
import { buildRenderFfmpegArgs } from "../content/buildRenderFfmpegArgs";

/**
 * Edit/render task — applies a sequence of edit operations to media.
 *
 * Triggered by PATCH /api/content. Accepts video or audio input and
 * runs operations (trim, crop, resize, overlay_text, mux_audio) in
 * order using ffmpeg. Uploads the result to fal.ai storage.
 */
export const createRenderTask = schemaTask({
  id: "create-render",
  schema: createRenderPayloadSchema,
  maxDuration: 600,
  machine: "medium-1x",
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);
    logStep("create-render task started", true, {
      accountId: payload.accountId,
      operationCount: payload.operations.length,
      outputFormat: payload.output_format,
    });

    const tempDir = join(tmpdir(), `render-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const inputPath = join(tempDir, "input.mp4");
    const outputPath = join(tempDir, `output.${payload.output_format}`);

    try {
      const inputUrl = payload.video_url ?? payload.audio_url;
      if (!inputUrl) throw new Error("No input media URL provided");

      logStep("Downloading input media");
      await downloadMediaToFile(inputUrl, inputPath);

      const ffmpegArgs = buildRenderFfmpegArgs(inputPath, outputPath, payload.operations);

      logStep("Running ffmpeg", true, { args: ffmpegArgs.join(" ") });
      await runFfmpeg(ffmpegArgs);

      logStep("Uploading rendered output");
      const result = await uploadToFalStorage(outputPath, `rendered.${payload.output_format}`, `video/${payload.output_format}`);

      logStep("Render complete", true, { url: result.url, sizeBytes: result.sizeBytes });

      return {
        status: "completed",
        url: result.url,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      };
    } finally {
      await Promise.all(
        [inputPath, outputPath].map((p) => unlink(p).catch(() => undefined)),
      );
    }
  },
});

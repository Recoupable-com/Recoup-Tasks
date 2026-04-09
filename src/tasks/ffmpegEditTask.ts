import { randomUUID } from "node:crypto";
import { unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { ffmpegEditPayloadSchema } from "../schemas/ffmpegEditSchema";
import { logStep } from "../sandboxes/logStep";
import { downloadMediaToFile } from "../content/downloadMediaToFile";
import { runFfmpeg } from "../content/runFfmpeg";
import { uploadToFalStorage } from "../content/uploadToFalStorage";
import { buildRenderFfmpegArgs } from "../content/buildRenderFfmpegArgs";

/**
 * FFmpeg edit task — applies video edit operations via ffmpeg.
 *
 * Triggered by PATCH /api/content. Accepts a video URL and runs
 * operations (trim, crop, resize, overlay_text) in order using ffmpeg.
 * Uploads the result to fal.ai storage.
 */
export const ffmpegEditTask = schemaTask({
  id: "ffmpeg-edit",
  schema: ffmpegEditPayloadSchema,
  maxDuration: 600,
  machine: "medium-1x",
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    await tags.add(`account:${payload.accountId}`);
    logStep("ffmpeg-edit task started", true, {
      accountId: payload.accountId,
      operationCount: payload.operations.length,
      outputFormat: payload.output_format,
    });

    const tempDir = join(tmpdir(), `render-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const inputPath = join(tempDir, "input.mp4");
    const outputPath = join(tempDir, `output.${payload.output_format}`);

    try {
      logStep("Downloading input video");
      await downloadMediaToFile(payload.video_url, inputPath);

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

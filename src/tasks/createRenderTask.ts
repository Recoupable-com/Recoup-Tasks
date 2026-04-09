import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fal } from "@fal-ai/client";
import { schemaTask, tags } from "@trigger.dev/sdk/v3";
import { createRenderPayloadSchema } from "../schemas/createRenderSchema";
import { logStep } from "../sandboxes/logStep";
import { escapeDrawtext } from "../content/escapeDrawtext";
import { stripEmoji } from "../content/stripEmoji";
import { buildRenderFfmpegArgs } from "../content/buildRenderFfmpegArgs";

const execFileAsync = promisify(execFile);

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

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("FAL_KEY environment variable is required");
    fal.config({ credentials: falKey });

    const tempDir = join(tmpdir(), `render-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const inputPath = join(tempDir, "input.mp4");
    const outputPath = join(tempDir, `output.${payload.output_format}`);

    try {
      const inputUrl = payload.video_url ?? payload.audio_url;
      if (!inputUrl) throw new Error("No input media URL provided");

      logStep("Downloading input media");
      const response = await fetch(inputUrl);
      if (!response.ok) throw new Error(`Failed to download input: ${response.status}`);
      await writeFile(inputPath, Buffer.from(await response.arrayBuffer()));

      const ffmpegArgs = buildRenderFfmpegArgs(inputPath, outputPath, payload.operations);

      logStep("Running ffmpeg", true, { args: ffmpegArgs.join(" ") });
      await execFileAsync("ffmpeg", ffmpegArgs);

      const outputBuffer = await readFile(outputPath);
      const mimeType = `video/${payload.output_format}`;
      const outputFile = new File([outputBuffer], `rendered.${payload.output_format}`, { type: mimeType });
      const resultUrl = await fal.storage.upload(outputFile);

      logStep("Render complete", true, {
        url: resultUrl,
        sizeBytes: outputBuffer.length,
      });

      return {
        status: "completed",
        url: resultUrl,
        mimeType,
        sizeBytes: outputBuffer.length,
      };
    } finally {
      await Promise.all(
        [inputPath, outputPath].map((p) => unlink(p).catch(() => undefined)),
      );
    }
  },
});

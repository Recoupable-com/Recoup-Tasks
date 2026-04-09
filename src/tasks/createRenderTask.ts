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
      // Download input media
      const inputUrl = payload.video_url ?? payload.audio_url;
      if (!inputUrl) throw new Error("No input media URL provided");

      logStep("Downloading input media");
      const response = await fetch(inputUrl);
      if (!response.ok) throw new Error(`Failed to download input: ${response.status}`);
      await writeFile(inputPath, Buffer.from(await response.arrayBuffer()));

      // Build ffmpeg args from operations
      const ffmpegArgs = buildFfmpegArgs(inputPath, outputPath, payload.operations);

      logStep("Running ffmpeg", true, { args: ffmpegArgs.join(" ") });
      await execFileAsync("ffmpeg", ffmpegArgs);

      // Upload result
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

/**
 * Builds ffmpeg arguments from a list of edit operations.
 *
 * @param inputPath - Path to the input media file.
 * @param outputPath - Path for the output file.
 * @param operations - Array of edit operations to apply in order.
 * @returns Array of ffmpeg CLI arguments.
 */
function buildFfmpegArgs(
  inputPath: string,
  outputPath: string,
  operations: CreateRenderOperations,
): string[] {
  const args = ["-y", "-i", inputPath];
  const videoFilters: string[] = [];
  const extraInputs: string[] = [];
  let audioMapping: string[] = [];

  for (const op of operations) {
    switch (op.type) {
      case "trim":
        args.splice(1, 0, "-ss", String(op.start), "-t", String(op.duration));
        break;

      case "crop":
        if (op.aspect) {
          const [w, h] = op.aspect.split(":").map(Number);
          if (w && h) {
            if (w > h) {
              videoFilters.push(`crop=ih*${w}/${h}:ih`);
            } else {
              videoFilters.push(`crop=iw:iw*${h}/${w}`);
            }
          }
        } else if (op.width || op.height) {
          const cw = op.width ?? -1;
          const ch = op.height ?? -1;
          videoFilters.push(`crop=${cw}:${ch}`);
        }
        break;

      case "resize":
        videoFilters.push(`scale=${op.width ?? -1}:${op.height ?? -1}`);
        break;

      case "overlay_text": {
        const escaped = op.content.replace(/'/g, "'\\''").replace(/:/g, "\\:");
        const filter = [
          `drawtext=text='${escaped}'`,
          `fontsize=${op.max_font_size}`,
          `fontcolor=${op.color}`,
          `borderw=${Math.max(2, Math.round(op.max_font_size / 14))}`,
          `bordercolor=${op.stroke_color}`,
          "x=(w-tw)/2",
          op.position === "top" ? "y=180" : op.position === "center" ? "y=(h-th)/2" : `y=h-th-120`,
        ].join(":");
        videoFilters.push(filter);
        break;
      }

      case "mux_audio":
        extraInputs.push("-i", op.audio_url);
        if (op.replace) {
          audioMapping = ["-map", "0:v:0", "-map", "1:a:0"];
        } else {
          audioMapping = ["-map", "0:v:0", "-filter_complex", "amix=inputs=2", "-map", "0:a", "-map", "1:a"];
        }
        break;
    }
  }

  if (videoFilters.length > 0) {
    args.push("-vf", videoFilters.join(","));
  }

  args.push(...extraInputs);

  if (audioMapping.length > 0) {
    args.push(...audioMapping);
  }

  args.push(
    "-c:v", "libx264",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-shortest",
    outputPath,
  );

  return args;
}

type CreateRenderOperations = typeof createRenderPayloadSchema extends { _output: { operations: infer O } } ? O : never;

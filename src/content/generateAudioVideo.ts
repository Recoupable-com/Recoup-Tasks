import { execFile } from "node:child_process";
import { readFile, writeFile, unlink, mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fal } from "@fal-ai/client";
import { logger } from "@trigger.dev/sdk/v3";
import { DEFAULT_PIPELINE_CONFIG } from "./defaultPipelineConfig";

const execFileAsync = promisify(execFile);

/**
 * Generates a video with audio baked in (lipsync mode) using fal.ai LTX-2.
 * The model creates lip-synced animation from image + audio.
 *
 * Matches the content-creation-app's generateAudioVideo.ts behavior.
 *
 * @param imageUrl - URL of the AI-generated image
 * @param songBuffer - Raw mp3 bytes of the song
 * @param audioStartSeconds - Where to clip the song from
 * @param audioDurationSeconds - How long the clip should be
 * @param motionPrompt - Describes how the subject should move
 * @returns URL of the generated video (with audio baked in)
 */
export async function generateAudioVideo({
  imageUrl,
  songBuffer,
  audioStartSeconds,
  audioDurationSeconds,
  motionPrompt,
}: {
  imageUrl: string;
  songBuffer: Buffer;
  audioStartSeconds: number;
  audioDurationSeconds: number;
  motionPrompt: string;
}): Promise<string> {
  const config = DEFAULT_PIPELINE_CONFIG;
  const durationSeconds = Math.min(
    audioDurationSeconds,
    config.audioVideoModelMaxSeconds,
  );
  const fps = 25;
  const numFrames = Math.round(durationSeconds * fps) + 1;

  // Clip the audio to the right section and upload to fal
  const audioUrl = await clipAndUploadAudio(
    songBuffer,
    audioStartSeconds,
    durationSeconds,
  );

  logger.log("Generating audio-to-video (lipsync)", {
    model: config.audioVideoModel,
    durationSeconds,
    numFrames,
  });

  const result = await fal.subscribe(config.audioVideoModel, {
    input: {
      prompt: motionPrompt,
      image_url: imageUrl,
      audio_url: audioUrl,
      match_audio_length: false,
      num_frames: numFrames,
      video_size: "landscape_16_9",
      fps,
      camera_lora: "static",
      guidance_scale: 3,
      num_inference_steps: 40,
      video_quality: "high",
    },
    logs: true,
  });

  const data = result.data as Record<string, unknown>;
  const videoUrl = extractFalUrl(data);

  if (!videoUrl) {
    throw new Error(
      `Audio-to-video returned no URL. Response: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  logger.log("Audio-to-video generated", { videoUrl: videoUrl.slice(0, 80) });
  return videoUrl;
}

/**
 * Clips the song mp3 to the specified range and uploads to fal storage.
 */
async function clipAndUploadAudio(
  songBuffer: Buffer,
  startSeconds: number,
  durationSeconds: number,
): Promise<string> {
  const tempDir = join(tmpdir(), `audio-clip-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });
  const inputPath = join(tempDir, "song.mp3");
  const clippedPath = join(tempDir, "clip.mp3");

  try {
    await writeFile(inputPath, songBuffer);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-ss", String(startSeconds),
      "-t", String(durationSeconds),
      "-c", "copy",
      clippedPath,
    ]);

    const clippedBuffer = await readFile(clippedPath);
    const file = new File([clippedBuffer], "clip.mp3", { type: "audio/mpeg" });
    const url = await fal.storage.upload(file);

    logger.log("Audio clip uploaded to fal", {
      startSeconds,
      durationSeconds,
      url: url.slice(0, 80),
    });

    return url;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function extractFalUrl(data: Record<string, unknown>): string | undefined {
  for (const key of ["image", "video"]) {
    if (data[key] && typeof data[key] === "object") {
      const url = (data[key] as Record<string, string>)?.url;
      if (url) return url;
    }
  }
  for (const key of ["images", "videos"]) {
    if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
      const url = ((data[key] as unknown[])[0] as Record<string, string>)?.url;
      if (url) return url;
    }
  }
  if (typeof data.url === "string") return data.url;
  return undefined;
}

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface RenderedContentVideo {
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Renders a short portrait MP4 with ffmpeg and returns it as a data URL.
 * This keeps rendering inside the task worker while storage remains in API.
 */
export async function renderContentVideo(): Promise<RenderedContentVideo> {
  const outputPath = join(tmpdir(), `create-content-${randomUUID()}.mp4`);

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=720x1280:d=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const fileBuffer = await readFile(outputPath);
    const mimeType = "video/mp4";
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

    return {
      dataUrl,
      mimeType,
      sizeBytes: fileBuffer.length,
    };
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}


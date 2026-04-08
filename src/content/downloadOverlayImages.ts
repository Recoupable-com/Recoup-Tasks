import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logStep } from "../sandboxes/logStep";
import { downloadImageBuffer } from "./downloadImageBuffer";

/**
 * Downloads overlay image URLs to local temp files.
 * Skips images that fail to download.
 *
 * @param urls - Image URLs to download
 * @param tempDir - Directory to write temp files into
 * @returns Array of local file paths for successfully downloaded images
 */
export async function downloadOverlayImages(
  urls: string[],
  tempDir: string,
): Promise<string[]> {
  if (urls.length === 0) return [];

  logStep("Downloading overlay images", true, { count: urls.length });
  const paths: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    try {
      const { buffer } = await downloadImageBuffer(urls[i]);
      const overlayPath = join(tempDir, `overlay-${i}.png`);
      await writeFile(overlayPath, buffer);
      paths.push(overlayPath);
    } catch {
      logStep("Overlay download failed, skipping", false, {
        url: urls[i].slice(0, 80),
        index: i,
      });
    }
  }

  return paths;
}

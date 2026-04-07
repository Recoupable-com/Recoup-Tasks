import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logStep } from "../sandboxes/logStep";

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
    const resp = await fetch(urls[i]);
    if (!resp.ok) continue;
    const buf = Buffer.from(await resp.arrayBuffer());
    const overlayPath = join(tempDir, `overlay-${i}.png`);
    await writeFile(overlayPath, buf);
    paths.push(overlayPath);
  }

  return paths;
}

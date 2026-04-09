import { writeFile } from "node:fs/promises";
import { downloadImageBuffer } from "./downloadImageBuffer";

/**
 * Download media from a URL and write it to a local file.
 * Reuses downloadImageBuffer for the fetch + error handling.
 *
 * @param url - Public URL of the media to download.
 * @param filePath - Local path to write the downloaded file.
 */
export async function downloadMediaToFile(url: string, filePath: string): Promise<void> {
  const { buffer } = await downloadImageBuffer(url);
  await writeFile(filePath, buffer);
}

import { writeFile } from "node:fs/promises";

/**
 * Download media from a URL and write it to a local file.
 *
 * @param url - Public URL of the media to download.
 * @param filePath - Local path to write the downloaded file.
 * @throws Error if the download fails.
 */
export async function downloadMediaToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
}

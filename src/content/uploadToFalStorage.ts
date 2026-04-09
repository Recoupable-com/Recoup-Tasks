import { readFile } from "node:fs/promises";
import { fal } from "@fal-ai/client";

export interface UploadResult {
  url: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Read a local file and upload it to fal.ai storage.
 *
 * @param filePath - Local path of the file to upload.
 * @param filename - Name for the uploaded file.
 * @param mimeType - MIME type of the file.
 * @returns Object with the uploaded URL, MIME type, and file size.
 */
export async function uploadToFalStorage(
  filePath: string,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  const buffer = await readFile(filePath);
  const file = new File([buffer], filename, { type: mimeType });
  const url = await fal.storage.upload(file);
  return { url, mimeType, sizeBytes: buffer.length };
}

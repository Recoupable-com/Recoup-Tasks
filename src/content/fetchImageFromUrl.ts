import { fal } from "@fal-ai/client";
import { logStep } from "../sandboxes/logStep";
import { downloadImageBuffer } from "./downloadImageBuffer";

/**
 * Downloads an image from a public URL and uploads it to fal.ai storage.
 *
 * @param imageUrl - Public URL of the image
 * @returns fal.ai storage URL for the uploaded image
 */
export async function fetchImageFromUrl(imageUrl: string): Promise<string> {
  logStep("Downloading image from URL");
  const { buffer, contentType } = await downloadImageBuffer(imageUrl);

  logStep("Uploading image to fal.ai storage", true, {
    sizeBytes: buffer.byteLength,
  });
  const originalName = new URL(imageUrl).pathname.split("/").pop() || "image.png";
  const faceGuideFile = new File([new Uint8Array(buffer)], originalName, { type: contentType });
  const falUrl = await fal.storage.upload(faceGuideFile);

  logStep("Image uploaded", false, { falUrl });
  return falUrl;
}

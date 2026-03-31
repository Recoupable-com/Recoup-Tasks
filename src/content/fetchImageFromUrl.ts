import { fal } from "@fal-ai/client";
import { logStep } from "../sandboxes/logStep";

/**
 * Downloads an image from a public URL and uploads it to fal.ai storage.
 *
 * @param imageUrl - Public URL of the image
 * @returns fal.ai storage URL for the uploaded image
 */
export async function fetchImageFromUrl(imageUrl: string): Promise<string> {
  logStep("Downloading image from URL");
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  logStep("Uploading image to fal.ai storage", true, {
    sizeBytes: imageBuffer.byteLength,
  });
  const contentType = response.headers.get("content-type") || "image/png";
  const originalName = new URL(imageUrl).pathname.split("/").pop() || "image.png";
  const faceGuideFile = new File([new Uint8Array(imageBuffer)], originalName, { type: contentType });
  const falUrl = await fal.storage.upload(faceGuideFile);

  logStep("Image uploaded", false, { falUrl });
  return falUrl;
}

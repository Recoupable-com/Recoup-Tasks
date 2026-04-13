import { logStep } from "../sandboxes/logStep";
import { createEditorialDetectionAgent } from "../agents/createEditorialDetectionAgent";

const EDITORIAL_EXAMPLE_URLS = [
  "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/content-attachments/image/1776085791241-Screenshot%202026-04-08%20at%203.27.37%E2%80%AFPM.png",
];

/**
 * Detects whether an image is an editorial press photo (professional portrait/press shot)
 * rather than a playlist cover, face guide, or other image type.
 *
 * Uses a few-shot approach: shows the model an example editorial photo first, then asks
 * it to classify the target image.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if the image is an editorial press photo, false otherwise
 */
export async function detectEditorialImage(imageUrl: string): Promise<boolean> {
  try {
    const agent = createEditorialDetectionAgent();
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: EDITORIAL_EXAMPLE_URLS[0] },
            { type: "text", text: "This is an example of an editorial press photo — a professionally styled portrait of an artist with cinematic lighting, clean background, and no text or overlays. Is this an editorial press photo?" },
          ],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: '{"isEditorial":true}' }],
        },
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            { type: "text", text: "Is this image an editorial press photo like the example above? An editorial press photo is a professionally styled portrait with intentional lighting and a clean background. Face guides (headshots on white/plain backgrounds), playlist covers, album art, and promotional graphics are NOT editorial press photos." },
          ],
        },
      ],
    });

    const isEditorial = output?.isEditorial ?? false;
    logStep("Editorial detection result", false, { imageUrl: imageUrl.slice(0, 80), isEditorial });
    return isEditorial;
  } catch (err) {
    logStep("Editorial detection failed, assuming not editorial", false, {
      imageUrl: imageUrl.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

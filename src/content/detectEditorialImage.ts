import { createEditorialDetectionAgent } from "../agents/createEditorialDetectionAgent";
import { runImageFewShotClassification } from "./runImageFewShotClassification";

const EDITORIAL_EXAMPLE_URL =
  "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/content-attachments/image/1776085791241-Screenshot%202026-04-08%20at%203.27.37%E2%80%AFPM.png";

/**
 * Detects whether an image is an editorial press photo (professional portrait/press shot)
 * rather than a playlist cover, face guide, or other image type.
 */
export async function detectEditorialImage(imageUrl: string): Promise<boolean> {
  return runImageFewShotClassification({
    agent: createEditorialDetectionAgent(),
    exampleImageUrl: EDITORIAL_EXAMPLE_URL,
    examplePrompt: "This is an example of an editorial press photo — a professionally styled portrait of an artist with cinematic lighting, clean background, and no text or overlays. Is this an editorial press photo?",
    targetImageUrl: imageUrl,
    targetPrompt: "Is this image an editorial press photo like the example above? An editorial press photo is a professionally styled portrait with intentional lighting and a clean background. Face guides (headshots on white/plain backgrounds), playlist covers, album art, and promotional graphics are NOT editorial press photos.",
    outputKey: "isEditorial",
    logLabel: "Editorial detection",
  });
}

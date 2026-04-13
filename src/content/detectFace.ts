import { createFaceDetectionAgent } from "../agents/createFaceDetectionAgent";
import { runImageFewShotClassification } from "./runImageFewShotClassification";

const FACE_GUIDE_EXAMPLE_URL =
  "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/content-attachments/image/1775671967694-face-guide-example.png";

/**
 * Detects whether an image is a face guide (headshot/portrait on a plain background)
 * rather than a playlist cover, album art, or other image that may incidentally contain a face.
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  return runImageFewShotClassification({
    agent: createFaceDetectionAgent(),
    exampleImageUrl: FACE_GUIDE_EXAMPLE_URL,
    examplePrompt: "This is an example of a face guide — a headshot or portrait on a plain/white background used for face-swapping. Is this a face guide?",
    targetImageUrl: imageUrl,
    targetPrompt: "Is this image a face guide like the example above? A face guide is a headshot or portrait on a plain background. Playlist covers, album art, promotional graphics, and other images that happen to show a face are NOT face guides.",
    outputKey: "hasFace",
    logLabel: "Face detection",
  });
}

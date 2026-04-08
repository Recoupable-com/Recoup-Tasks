import { readFileSync } from "node:fs";
import { join } from "node:path";
import { logStep } from "../sandboxes/logStep";
import { createFaceDetectionAgent } from "../agents/createFaceDetectionAgent";

const FACE_GUIDE_EXAMPLE_PATH = join(__dirname, "references", "face-guide-example.png");
const faceGuideExampleBuffer = readFileSync(FACE_GUIDE_EXAMPLE_PATH);

/**
 * Detects whether an image is a face guide (headshot/portrait on a plain background)
 * rather than a playlist cover, album art, or other image that may incidentally contain a face.
 *
 * Uses a few-shot approach: shows the model an example face guide first, then asks
 * it to classify the target image.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if the image is a face guide, false otherwise
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  try {
    const agent = createFaceDetectionAgent();
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: faceGuideExampleBuffer },
            { type: "text", text: "This is an example of a face guide — a headshot or portrait on a plain/white background used for face-swapping. Is this a face guide?" },
          ],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: '{"hasFace":true}' }],
        },
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            { type: "text", text: "Is this image a face guide like the example above? A face guide is a headshot or portrait on a plain background. Playlist covers, album art, promotional graphics, and other images that happen to show a face are NOT face guides." },
          ],
        },
      ],
    });

    const hasFace = output?.hasFace ?? false;
    logStep("Face detection result", false, { imageUrl: imageUrl.slice(0, 80), hasFace });
    return hasFace;
  } catch (err) {
    logStep("Face detection failed, assuming no face", false, {
      imageUrl: imageUrl.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

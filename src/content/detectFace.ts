import { logStep } from "../sandboxes/logStep";
import { createFaceDetectionAgent } from "../agents/createFaceDetectionAgent";

/**
 * Detects whether an image contains a human face using a vision-capable text model.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if the image contains a face/portrait, false otherwise
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  try {
    const agent = createFaceDetectionAgent();
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            { type: "text", text: "Does this image contain a human face as the primary subject?" },
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

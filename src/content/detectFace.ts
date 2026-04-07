import { logStep } from "../sandboxes/logStep";
import { falSubscribe } from "./falSubscribe";

const DETECTION_MODEL = "fal-ai/florence-2-large/object-detection";

/** Labels that indicate a human face or person is present in the image. */
const FACE_LABELS = ["person", "face", "human face", "man", "woman", "boy", "girl"];

/**
 * Detects whether an image contains a human face using Florence-2 object detection.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if at least one face/person is detected, false otherwise
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  try {
    const result = await falSubscribe(DETECTION_MODEL, {
      image_url: imageUrl,
    });

    const data = result.data as Record<string, unknown>;
    const results = data.results as { labels?: string[] } | undefined;
    const labels = results?.labels ?? [];

    const hasFace = labels.some((label) =>
      FACE_LABELS.some((faceLabel) => label.toLowerCase().includes(faceLabel)),
    );
    logStep("Face detection result", false, { imageUrl: imageUrl.slice(0, 80), hasFace, labels });
    return hasFace;
  } catch {
    logStep("Face detection failed, assuming no face", false, {
      imageUrl: imageUrl.slice(0, 80),
    });
    return false;
  }
}

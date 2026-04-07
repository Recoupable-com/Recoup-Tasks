import { logger } from "@trigger.dev/sdk/v3";
import { falSubscribe } from "./falSubscribe";

const FACE_DETECTION_MODEL = "fal-ai/face-detection";

/**
 * Detects whether an image contains a human face using fal.ai face detection.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if at least one face is detected, false otherwise
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  try {
    const result = await falSubscribe(FACE_DETECTION_MODEL, {
      image_url: imageUrl,
    });

    const data = result.data as Record<string, unknown>;
    const faces = data.faces as unknown[];

    const hasFace = Array.isArray(faces) && faces.length > 0;
    logger.log("Face detection result", { imageUrl: imageUrl.slice(0, 80), hasFace });
    return hasFace;
  } catch {
    logger.log("Face detection failed, assuming no face", {
      imageUrl: imageUrl.slice(0, 80),
    });
    return false;
  }
}

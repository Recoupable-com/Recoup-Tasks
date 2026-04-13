import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";
import { IMAGE_DETECTION_MODEL } from "./imageDetectionModel";

const faceDetectionSchema = z.object({
  hasFace: z.boolean(),
});

const instructions = `You classify images as face guides or not.

A face guide is a headshot or portrait photo on a plain or white background, used for face-swapping in AI image generation. It shows a person's face clearly as the primary subject.

These are NOT face guides:
- Playlist covers or album art (even if they show a person)
- Promotional graphics with text overlays
- Concert photos or action shots
- Logos or branded images
- Any image where the face is not the sole focus on a clean background

Return hasFace: true ONLY for face guide images (headshots on plain backgrounds).
Return hasFace: false for everything else.`;

/**
 * Creates a ToolLoopAgent configured for face guide detection in images.
 * Uses Output.object with a Zod schema for structured boolean response.
 *
 * @returns A configured ToolLoopAgent using Google Gemini via AI Gateway.
 */
export function createFaceDetectionAgent() {
  return new ToolLoopAgent({
    model: IMAGE_DETECTION_MODEL,
    instructions,
    output: Output.object({ schema: faceDetectionSchema }),
    stopWhen: stepCountIs(1),
  });
}

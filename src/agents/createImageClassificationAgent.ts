import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";
import { IMAGE_DETECTION_MODEL } from "./imageDetectionModel";

export const IMAGE_KINDS = ["face_guide", "editorial", "additional"] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

const imageClassificationSchema = z.object({
  kind: z.enum(IMAGE_KINDS),
});

const instructions = `You classify each image into exactly ONE of three categories for an AI content pipeline.

**face_guide** — a headshot or portrait on a plain/white background used for face-swapping. The face is the sole focus and the background is clean/solid.

**editorial** — a professionally styled press photo of an artist. Cinematic or intentional lighting, posed subject, clean or blurred background, no text or overlays. Looks like it was shot by a professional photographer for a magazine feature or editorial playlist.

**additional** — everything else. Playlist covers, album art, promotional graphics, concert/live shots, casual phone photos, screenshots, logos, branded assets, collages — anything that is neither a face guide nor an editorial press photo.

Rules:
- Return exactly one kind per image.
- "face_guide" requires a plain/solid background. A headshot with a busy or environmental background is "editorial" (if styled) or "additional".
- "editorial" requires professional styling. A plain headshot is "face_guide", not "editorial".
- When in doubt between editorial and additional, prefer "additional" (the safe default).`;

/**
 * Creates a ToolLoopAgent that classifies an image into face_guide / editorial / additional
 * in a single call. Replaces the previous per-kind binary detectors.
 */
export function createImageClassificationAgent() {
  return new ToolLoopAgent({
    model: IMAGE_DETECTION_MODEL,
    instructions,
    output: Output.object({ schema: imageClassificationSchema }),
    stopWhen: stepCountIs(1),
  });
}

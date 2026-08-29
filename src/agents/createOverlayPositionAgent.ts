import { ToolLoopAgent, Output, stepCountIs } from "ai";
import { z } from "zod";
import { IMAGE_DETECTION_MODEL } from "./imageDetectionModel";
import { OVERLAY_POSITIONS } from "../content/overlayPosition";

const overlayPositionSchema = z.object({
  position: z.enum(OVERLAY_POSITIONS),
});

const instructions = `You analyze an editorial image to determine the best corner to place small overlay images (like playlist covers or DSP logos) so they do not obscure the subject.

Choose exactly ONE of four positions: top-left, top-right, bottom-left, bottom-right.

Rules:
- Pick the corner that has the LEAST visual importance — the emptiest or most uniform area.
- Avoid placing overlays on top of the subject's face, hands, or other key focal points.
- If the subject is centered and all corners are roughly equal, prefer "top-left" as the default.
- If the background is blurred or uniform on one side, prefer that side.
- Consider that overlays will be 250×250 pixels stacked vertically in the chosen corner of a 720×1280 (9:16 portrait) frame.`;

/**
 * Creates a ToolLoopAgent that analyzes an editorial image and returns
 * the best corner position for overlay images.
 */
export function createOverlayPositionAgent() {
  return new ToolLoopAgent({
    model: IMAGE_DETECTION_MODEL,
    instructions,
    output: Output.object({ schema: overlayPositionSchema }),
    stopWhen: stepCountIs(1),
  });
}

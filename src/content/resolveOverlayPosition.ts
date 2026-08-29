import { logStep } from "../sandboxes/logStep";
import { createOverlayPositionAgent } from "../agents/createOverlayPositionAgent";
import type { OverlayPosition } from "./overlayPosition";

/**
 * Analyzes the editorial image to determine the best corner for overlay placement.
 * Falls back to "top-left" on any failure.
 */
export async function resolveOverlayPosition(
  editorialImageUrl: string,
): Promise<OverlayPosition> {
  try {
    const agent = createOverlayPositionAgent();
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: editorialImageUrl },
            { type: "text", text: "Analyze this editorial image and determine the best corner to place overlay images." },
          ],
        },
      ],
    });

    const position = output?.position ?? "top-left";
    logStep("Overlay position resolved", false, { editorialImageUrl, position });
    return position as OverlayPosition;
  } catch (err) {
    logStep("Overlay position analysis failed, defaulting to top-left", false, {
      editorialImageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return "top-left";
  }
}

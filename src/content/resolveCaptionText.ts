import { generateCaption } from "../recoup/contentApi";
import type { CaptionLength } from "../schemas/contentCreationSchema";

/**
 * Resolves caption text for the final render. Returns "" when the caller
 * opted out of captions ("none"); otherwise calls the caption generation API.
 *
 * @param params.captionLength - "none" skips generation, otherwise passed to the API.
 * @param params.topic - Caption topic seed (song, lyrics, mood, etc).
 * @param params.template - Template ID for prompt selection.
 */
export async function resolveCaptionText({
  captionLength,
  topic,
  template,
}: {
  captionLength: CaptionLength;
  topic: string;
  template: string;
}): Promise<string> {
  if (captionLength === "none") return "";
  return generateCaption({ topic, template, length: captionLength });
}

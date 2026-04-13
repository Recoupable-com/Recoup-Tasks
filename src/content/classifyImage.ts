import { logStep } from "../sandboxes/logStep";
import {
  createImageClassificationAgent,
  type ImageKind,
} from "../agents/createImageClassificationAgent";

const FACE_GUIDE_EXAMPLE_URL =
  "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/content-attachments/image/1775671967694-face-guide-example.png";
const EDITORIAL_EXAMPLE_URL =
  "https://dxfamqbi5zyezrs5.public.blob.vercel-storage.com/content-attachments/image/1776085791241-Screenshot%202026-04-08%20at%203.27.37%E2%80%AFPM.png";

/**
 * Classifies an image into face_guide, editorial, or additional using a single
 * few-shot Gemini call (one example per positive kind; "additional" is the default).
 *
 * Returns "additional" on any failure (safe fallback — matches prior behavior
 * where detection errors caused the image to be treated as non-special).
 */
export async function classifyImage(imageUrl: string): Promise<ImageKind> {
  try {
    const agent = createImageClassificationAgent();
    const { output } = await agent.generate({
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: FACE_GUIDE_EXAMPLE_URL },
            { type: "text", text: "Classify this image." },
          ],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: '{"kind":"face_guide"}' }],
        },
        {
          role: "user",
          content: [
            { type: "image", image: EDITORIAL_EXAMPLE_URL },
            { type: "text", text: "Classify this image." },
          ],
        },
        {
          role: "assistant",
          content: [{ type: "text", text: '{"kind":"editorial"}' }],
        },
        {
          role: "user",
          content: [
            { type: "image", image: imageUrl },
            { type: "text", text: "Classify this image." },
          ],
        },
      ],
    });

    const kind = output?.kind ?? "additional";
    logStep("Image classification result", false, { imageUrl, kind });
    return kind as ImageKind;
  } catch (err) {
    logStep("Image classification failed, defaulting to additional", false, {
      imageUrl,
      error: err instanceof Error ? err.message : String(err),
    });
    return "additional";
  }
}

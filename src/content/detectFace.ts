import { logStep } from "../sandboxes/logStep";

const PROMPT_PREFIX = `Look at the image at this URL and determine if it contains a human face or person portrait (headshot, selfie, press photo, etc).

Respond with ONLY "true" or "false". Nothing else.

Image URL: `;

/**
 * Detects whether an image contains a human face using a vision-capable text model.
 *
 * @param imageUrl - URL of the image to analyze
 * @returns true if the image contains a face/portrait, false otherwise
 */
export async function detectFace(imageUrl: string): Promise<boolean> {
  try {
    const recoupApiKey = process.env.RECOUP_API_KEY;
    if (!recoupApiKey) {
      logStep("Face detection skipped — RECOUP_API_KEY not set", false);
      return false;
    }

    const recoupApiUrl = process.env.RECOUP_API_URL ?? "https://recoup-api.vercel.app";
    const response = await fetch(`${recoupApiUrl}/api/chat/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": recoupApiKey,
      },
      body: JSON.stringify({
        prompt: `${PROMPT_PREFIX}${imageUrl}`,
        model: "google/gemini-2.5-flash",
        excludeTools: ["create_task"],
      }),
    });

    if (!response.ok) {
      logStep("Face detection API returned error", false, { status: response.status });
      return false;
    }

    const json = (await response.json()) as { text?: string };
    const answer = (json.text ?? "").trim().toLowerCase();
    const hasFace = answer === "true";

    logStep("Face detection result", false, { imageUrl: imageUrl.slice(0, 80), hasFace, answer });
    return hasFace;
  } catch (err) {
    logStep("Face detection failed, assuming no face", false, {
      imageUrl: imageUrl.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

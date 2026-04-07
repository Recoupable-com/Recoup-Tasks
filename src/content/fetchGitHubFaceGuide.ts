import { fal } from "@fal-ai/client";
import { logStep } from "../sandboxes/logStep";
import { fetchGithubFile } from "./fetchGithubFile";

/**
 * Fetches the artist's face-guide.png from their GitHub repo and uploads it to fal.ai storage.
 *
 * @param githubRepo - The GitHub repo URL
 * @param artistSlug - The artist slug for the file path
 * @returns fal.ai storage URL of the face guide
 * @throws Error if face-guide.png is not found
 */
export async function fetchGitHubFaceGuide(
  githubRepo: string,
  artistSlug: string,
): Promise<string> {
  logStep("Fetching face-guide from GitHub");
  const buffer = await fetchGithubFile(
    githubRepo,
    `artists/${artistSlug}/context/images/face-guide.png`,
  );
  if (!buffer) {
    throw new Error(`face-guide.png not found for artist ${artistSlug}`);
  }

  logStep("Uploading face-guide to fal.ai storage", true, {
    sizeBytes: buffer.byteLength,
  });
  const file = new File([buffer], "face-guide.png", { type: "image/png" });
  const faceGuideUrl = await fal.storage.upload(file);
  logStep("Face-guide uploaded", false, { faceGuideUrl });
  return faceGuideUrl;
}

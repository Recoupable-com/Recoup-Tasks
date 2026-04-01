import { fal } from "@fal-ai/client";
import { logStep } from "../sandboxes/logStep";
import { fetchImageFromUrl } from "./fetchImageFromUrl";
import { fetchGithubFile } from "./fetchGithubFile";

/**
 * Resolves the face guide URL for the content pipeline.
 * Uses the first image from the images array if provided,
 * otherwise fetches face-guide.png from the artist's GitHub repo.
 *
 * @returns fal.ai storage URL, or null if template doesn't use face guide
 */
export async function resolveFaceGuide({
  usesFaceGuide,
  images,
  githubRepo,
  artistSlug,
}: {
  usesFaceGuide: boolean;
  images: string[] | undefined;
  githubRepo: string;
  artistSlug: string;
}): Promise<string | null> {
  if (!usesFaceGuide) return null;

  const imageUrl = images?.[0];
  if (imageUrl) {
    return fetchImageFromUrl(imageUrl);
  }

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
  const falUrl = await fal.storage.upload(file);
  logStep("Face-guide uploaded", false, { faceGuideUrl: falUrl });
  return falUrl;
}

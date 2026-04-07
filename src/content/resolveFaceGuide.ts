import { fal } from "@fal-ai/client";
import { logStep } from "../sandboxes/logStep";
import { detectFace } from "./detectFace";
import { fetchImageFromUrl } from "./fetchImageFromUrl";
import { fetchGithubFile } from "./fetchGithubFile";

export interface ResolveFaceGuideResult {
  faceGuideUrl: string | null;
  additionalImageUrls: string[];
}

/**
 * Resolves the face guide URL and additional image URLs for the content pipeline.
 *
 * Analyzes each image in the images array to detect faces:
 * - The first face image becomes the face guide
 * - Non-face images (album covers, playlist covers, etc.) become additional image URLs
 * - If no face is found in images and usesFaceGuide is true, fetches face-guide.png from GitHub
 *
 * @returns faceGuideUrl (or null) and additionalImageUrls for the model
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
}): Promise<ResolveFaceGuideResult> {
  let faceGuideUrl: string | null = null;
  const additionalImageUrls: string[] = [];

  // Upload and classify each provided image
  if (images?.length) {
    for (const imageUrl of images) {
      const uploadedUrl = await fetchImageFromUrl(imageUrl);

      if (usesFaceGuide && !faceGuideUrl) {
        const hasFace = await detectFace(uploadedUrl);
        if (hasFace) {
          faceGuideUrl = uploadedUrl;
          continue;
        }
      }

      additionalImageUrls.push(uploadedUrl);
    }
  }

  // Fall back to GitHub face-guide if needed
  if (usesFaceGuide && !faceGuideUrl) {
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
    faceGuideUrl = await fal.storage.upload(file);
    logStep("Face-guide uploaded", false, { faceGuideUrl });
  }

  return { faceGuideUrl, additionalImageUrls };
}

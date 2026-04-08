import { classifyImages } from "./classifyImages";
import { fetchGitHubFaceGuide } from "./fetchGitHubFaceGuide";

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
  const { faceGuideUrl, additionalImageUrls } = images?.length
    ? await classifyImages({ images, usesFaceGuide })
    : { faceGuideUrl: null, additionalImageUrls: [] };

  // Fall back to GitHub face-guide if needed
  if (usesFaceGuide && !faceGuideUrl) {
    const fallbackUrl = await fetchGitHubFaceGuide(githubRepo, artistSlug);
    return { faceGuideUrl: fallbackUrl, additionalImageUrls };
  }

  return { faceGuideUrl, additionalImageUrls };
}

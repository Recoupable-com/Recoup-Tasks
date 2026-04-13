import { classifyImages } from "./classifyImages";
import { fetchGitHubFaceGuide } from "./fetchGitHubFaceGuide";

export interface ResolveFaceGuideResult {
  faceGuideUrl: string | null;
  editorialImageUrl: string | null;
  additionalImageUrls: string[];
}

/**
 * Resolves the face guide URL, editorial image URL, and additional image URLs for the content pipeline.
 *
 * Analyzes each image in the images array to detect faces and editorial photos:
 * - The first face image becomes the face guide
 * - The first editorial press photo becomes the editorial image (skips AI image generation)
 * - Non-face, non-editorial images (album covers, playlist covers, etc.) become additional image URLs
 * - If no face is found in images and usesFaceGuide is true, fetches face-guide.png from GitHub
 *
 * @returns faceGuideUrl (or null), editorialImageUrl (or null), and additionalImageUrls for the model
 */
export async function resolveFaceGuide({
  usesFaceGuide,
  usesImageOverlay,
  images,
  githubRepo,
  artistSlug,
}: {
  usesFaceGuide: boolean;
  usesImageOverlay: boolean;
  images: string[] | undefined;
  githubRepo: string;
  artistSlug: string;
}): Promise<ResolveFaceGuideResult> {
  const { faceGuideUrl, editorialImageUrl, additionalImageUrls } = images?.length
    ? await classifyImages({ images, usesFaceGuide, usesImageOverlay })
    : { faceGuideUrl: null, editorialImageUrl: null, additionalImageUrls: [] };

  // Fall back to GitHub face-guide if needed
  if (usesFaceGuide && !faceGuideUrl) {
    const fallbackUrl = await fetchGitHubFaceGuide(githubRepo, artistSlug);
    return { faceGuideUrl: fallbackUrl, editorialImageUrl, additionalImageUrls };
  }

  return { faceGuideUrl, editorialImageUrl, additionalImageUrls };
}

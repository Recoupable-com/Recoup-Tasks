import { detectFace } from "./detectFace";
import { fetchImageFromUrl } from "./fetchImageFromUrl";
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
    faceGuideUrl = await fetchGitHubFaceGuide(githubRepo, artistSlug);
  }

  return { faceGuideUrl, additionalImageUrls };
}

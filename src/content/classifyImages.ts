import { detectFace } from "./detectFace";
import { fetchImageFromUrl } from "./fetchImageFromUrl";

/**
 * Uploads and classifies images into face guide and additional image URLs.
 *
 * For each image:
 *   - If usesFaceGuide and no face guide found yet, runs face detection
 *   - First face image becomes the face guide
 *   - All other images become additional image URLs
 *
 * @returns The first face image URL (or null) and remaining additional URLs
 */
export async function classifyImages({
  images,
  usesFaceGuide,
}: {
  images: string[];
  usesFaceGuide: boolean;
}): Promise<{
  faceGuideUrl: string | null;
  additionalImageUrls: string[];
}> {
  let faceGuideUrl: string | null = null;
  const additionalImageUrls: string[] = [];

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

  return { faceGuideUrl, additionalImageUrls };
}

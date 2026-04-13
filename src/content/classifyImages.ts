import { detectFace } from "./detectFace";
import { detectEditorialImage } from "./detectEditorialImage";
import { fetchImageFromUrl } from "./fetchImageFromUrl";

/**
 * Uploads and classifies images into face guide, editorial image, and additional image URLs.
 *
 * For each image:
 *   - If usesFaceGuide and no face guide found yet, runs face detection
 *   - First face image becomes the face guide
 *   - If usesEditorialImage and no editorial image found yet, runs editorial detection
 *   - First editorial image becomes the editorial image (used in place of AI-generated image)
 *   - All other images become additional image URLs
 *
 * @returns The first face image URL (or null), editorial image URL (or null), and remaining additional URLs
 */
export async function classifyImages({
  images,
  usesFaceGuide,
  usesEditorialImage,
}: {
  images: string[];
  usesFaceGuide: boolean;
  usesEditorialImage: boolean;
}): Promise<{
  faceGuideUrl: string | null;
  editorialImageUrl: string | null;
  additionalImageUrls: string[];
}> {
  let faceGuideUrl: string | null = null;
  let editorialImageUrl: string | null = null;
  const additionalImageUrls: string[] = [];

  for (const imageUrl of images) {
    const uploadedUrl = await fetchImageFromUrl(imageUrl);

    if (usesFaceGuide && !faceGuideUrl) {
      const hasFace = await detectFace(imageUrl);
      if (hasFace) {
        faceGuideUrl = uploadedUrl;
        continue;
      }
    }

    if (usesEditorialImage && !editorialImageUrl) {
      const isEditorial = await detectEditorialImage(imageUrl);
      if (isEditorial) {
        editorialImageUrl = uploadedUrl;
        continue;
      }
    }

    additionalImageUrls.push(uploadedUrl);
  }

  return { faceGuideUrl, editorialImageUrl, additionalImageUrls };
}

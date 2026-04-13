import { classifyImage } from "./classifyImage";
import { fetchImageFromUrl } from "./fetchImageFromUrl";

/**
 * Uploads and classifies images using a single-call classifier per image
 * (face_guide / editorial / additional).
 *
 * For each image:
 *   - First face_guide match becomes the face guide (if usesFaceGuide)
 *   - First editorial match becomes the editorial image (if usesEditorialImage)
 *   - Everything else — including later duplicates of already-matched kinds — goes to additionalImageUrls
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

  const needsClassification = usesFaceGuide || usesEditorialImage;

  for (const imageUrl of images) {
    const uploadedUrl = await fetchImageFromUrl(imageUrl);
    const kind = needsClassification ? await classifyImage(imageUrl) : "additional";

    if (kind === "face_guide" && usesFaceGuide && !faceGuideUrl) {
      faceGuideUrl = uploadedUrl;
    } else if (kind === "editorial" && usesEditorialImage && !editorialImageUrl) {
      editorialImageUrl = uploadedUrl;
    } else {
      additionalImageUrls.push(uploadedUrl);
    }
  }

  return { faceGuideUrl, editorialImageUrl, additionalImageUrls };
}

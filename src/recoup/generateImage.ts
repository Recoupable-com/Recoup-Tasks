import { callRecoupApi } from "./callRecoupApi";

/**
 * Generate an image via POST /api/content/image.
 *
 * @param params - Image generation parameters.
 * @returns URL of the generated image.
 */
export async function generateImage(params: {
  prompt: string;
  referenceImageUrl?: string;
  images?: string[];
}): Promise<string> {
  const body: Record<string, unknown> = { prompt: params.prompt };
  if (params.referenceImageUrl) body.reference_image_url = params.referenceImageUrl;
  if (params.images) {
    const validUrls = params.images.filter(url => url.startsWith("http"));
    if (validUrls.length > 0) body.images = validUrls;
  }

  const data = await callRecoupApi("/api/content/image", body);
  return data.imageUrl as string;
}

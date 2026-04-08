/**
 * Downloads an image from a URL and returns its buffer and content type.
 *
 * @param imageUrl - Public URL of the image
 * @returns The image buffer and content type
 */
export async function downloadImageBuffer(imageUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";
  return { buffer, contentType };
}

import { callRecoupApi } from "./callRecoupApi";

/**
 * Upscale an image or video via POST /api/content/upscale.
 *
 * @param url - URL of the media to upscale.
 * @param type - Whether the input is an image or video.
 * @returns URL of the upscaled media.
 */
export async function upscaleMedia(url: string, type: "image" | "video"): Promise<string> {
  const data = await callRecoupApi("/api/content/upscale", { url, type });
  return data.url as string;
}

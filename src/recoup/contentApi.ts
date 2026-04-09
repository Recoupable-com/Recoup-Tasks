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
  if (params.images) body.images = params.images;

  const data = await callRecoupApi("/api/content/image", body);
  return data.imageUrl as string;
}

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

/**
 * Generate a video via POST /api/content/video.
 *
 * @param params - Video generation parameters.
 * @returns URL of the generated video.
 */
export async function generateVideo(params: {
  imageUrl: string;
  prompt: string;
  audioUrl?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    image_url: params.imageUrl,
    prompt: params.prompt,
  };
  if (params.audioUrl) body.audio_url = params.audioUrl;

  const data = await callRecoupApi("/api/content/video", body);
  return data.videoUrl as string;
}

/**
 * Generate a caption via POST /api/content/caption.
 *
 * @param params - Caption generation parameters.
 * @returns Generated caption text.
 */
export async function generateCaption(params: {
  topic: string;
  template?: string;
  length?: string;
}): Promise<string> {
  const body: Record<string, unknown> = { topic: params.topic };
  if (params.template) body.template = params.template;
  if (params.length) body.length = params.length;

  const data = await callRecoupApi("/api/content/caption", body);
  return data.content as string;
}

import { callRecoupApi } from "./callRecoupApi";

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

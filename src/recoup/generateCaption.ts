import { callRecoupApi } from "./callRecoupApi";

const API_TEMPLATE_IDS = [
  "artist-caption-bedroom",
  "artist-caption-outside",
  "artist-caption-stage",
  "album-record-store",
];

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
  if (params.template && API_TEMPLATE_IDS.includes(params.template)) body.template = params.template;
  if (params.length) body.length = params.length;

  const data = await callRecoupApi("/api/content/caption", body);
  return data.content as string;
}

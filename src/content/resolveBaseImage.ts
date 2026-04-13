import { logStep } from "../sandboxes/logStep";
import { generateImage, upscaleMedia } from "../recoup/contentApi";
import { pickRandomReferenceImage, buildImagePrompt, type TemplateData } from "./loadTemplate";
import { resolveImageInstruction } from "./resolveImageInstruction";

/**
 * Resolves the base image for video generation.
 *
 * If an editorial image was attached and classified, use it directly and skip
 * AI image generation (and any upscale). Otherwise, generate a new image from
 * the template + face guide + additional reference images, and optionally
 * upscale the result.
 */
export async function resolveBaseImage({
  editorialImageUrl,
  faceGuideUrl,
  additionalImageUrls,
  template,
  upscale,
}: {
  editorialImageUrl: string | null;
  faceGuideUrl: string | null;
  additionalImageUrls: string[];
  template: TemplateData;
  upscale: boolean;
}): Promise<string> {
  if (editorialImageUrl) {
    logStep("Using attached editorial image, skipping AI image generation", true, {
      editorialImageUrl,
    });
    return editorialImageUrl;
  }

  logStep("Generating image via API");
  const referenceImagePath = pickRandomReferenceImage(template);
  const instruction = resolveImageInstruction(template);
  const basePrompt = `${instruction} ${template.imagePrompt}`;
  const fullPrompt = buildImagePrompt(basePrompt, template.styleGuide);

  const imageRefs: string[] = [];
  if (faceGuideUrl) imageRefs.push(faceGuideUrl);
  if (referenceImagePath) imageRefs.push(referenceImagePath);
  if (!template.usesImageOverlay && additionalImageUrls.length) {
    imageRefs.push(...additionalImageUrls);
  }

  let imageUrl = await generateImage({
    prompt: fullPrompt,
    referenceImageUrl: faceGuideUrl ?? undefined,
    images: imageRefs.length > 0 ? imageRefs : undefined,
  });

  if (upscale) {
    logStep("Upscaling image via API");
    imageUrl = await upscaleMedia(imageUrl, "image");
  }

  return imageUrl;
}

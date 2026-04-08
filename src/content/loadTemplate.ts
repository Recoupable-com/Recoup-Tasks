import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { logStep } from "../sandboxes/logStep";
import { resolveTemplatesDir } from "./resolveTemplatesDir";
import { loadJsonFile } from "./loadJsonFile";

const styleGuideSchema = z.object({
  imagePrompt: z.string().default(""),
  usesFaceGuide: z.boolean().default(true),
  usesImageOverlay: z.boolean().default(false),
}).passthrough();

/**
 * Template data loaded from the bundled templates directory.
 */
export interface TemplateData {
  name: string;
  /** Template-specific image prompt describing the scene/setting. */
  imagePrompt: string;
  /** Whether this template uses the artist's face-guide for identity. Defaults to true. */
  usesFaceGuide: boolean;
  /** Whether attached images (playlist covers, logos) should be overlaid on the final video. Defaults to false. */
  usesImageOverlay: boolean;
  styleGuide: Record<string, unknown> | null;
  captionGuide: Record<string, unknown> | null;
  captionExamples: string[];
  videoMoods: string[];
  videoMovements: string[];
  referenceImagePaths: string[];
}

/**
 * Load all template data (style guide, caption guide, moods, movements, reference images).
 */
export async function loadTemplate(templateName: string): Promise<TemplateData> {
  const templatesDir = await resolveTemplatesDir(__dirname);
  const templateDir = path.join(templatesDir, templateName);

  logStep("loadTemplate: resolving paths", false, {
    __dirname,
    cwd: process.cwd(),
    templatesDir,
    templateDir,
  });

  // Check the template directory exists
  try {
    await fs.access(templateDir);
  } catch {
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  const styleGuide = await loadJsonFile<Record<string, unknown>>(
    path.join(templateDir, "style-guide.json"),
    "style-guide.json",
  );
  const captionGuide = await loadJsonFile<Record<string, unknown>>(
    path.join(templateDir, "caption-guide.json"),
    "caption-guide.json",
  );
  const captionExamples = await loadJsonFile<string[]>(
    path.join(templateDir, "references", "captions", "examples.json"),
    "references/captions/examples.json",
  ) ?? [];
  const videoMoods = await loadJsonFile<string[]>(
    path.join(templateDir, "video-moods.json"),
    "video-moods.json",
  ) ?? [];
  const videoMovements = await loadJsonFile<string[]>(
    path.join(templateDir, "video-movements.json"),
    "video-movements.json",
  ) ?? [];

  // Discover reference images
  const imagesDir = path.join(templateDir, "references", "images");
  let referenceImagePaths: string[] = [];
  try {
    const files = await fs.readdir(imagesDir);
    referenceImagePaths = files
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
      .map(f => path.join(imagesDir, f));
    logStep("loadTemplate: reference images found", false, {
      count: referenceImagePaths.length,
    });
  } catch {
    logStep("loadTemplate: no reference images directory", false, { imagesDir });
  }

  // Read and validate template-level fields from the style guide
  const parsed = styleGuideSchema.safeParse(styleGuide ?? {});
  const sg = parsed.success ? parsed.data : { imagePrompt: "", usesFaceGuide: true, usesImageOverlay: false };
  const imagePrompt = sg.imagePrompt;
  const usesFaceGuide = sg.usesFaceGuide;
  const usesImageOverlay = sg.usesImageOverlay;

  logStep("loadTemplate: result summary", false, {
    template: templateName,
    hasStyleGuide: styleGuide !== null,
    hasCaptionGuide: captionGuide !== null,
    captionExamplesCount: captionExamples.length,
    videoMoodsCount: videoMoods.length,
    videoMovementsCount: videoMovements.length,
    referenceImagesCount: referenceImagePaths.length,
    imagePromptLength: imagePrompt.length,
    usesFaceGuide,
    usesImageOverlay,
  });

  return {
    name: templateName,
    imagePrompt,
    usesFaceGuide,
    usesImageOverlay,
    styleGuide,
    captionGuide,
    captionExamples,
    videoMoods,
    videoMovements,
    referenceImagePaths,
  };
}

/**
 * Pick a random reference image path from the template.
 */
export function pickRandomReferenceImage(template: TemplateData): string | null {
  if (template.referenceImagePaths.length === 0) return null;
  const idx = Math.floor(Math.random() * template.referenceImagePaths.length);
  return template.referenceImagePaths[idx];
}

/**
 * Build the full image prompt by combining the base prompt with the style guide rules.
 * Matches the logic from the content-creation-app's generateImage.ts.
 */
export function buildImagePrompt(
  basePrompt: string,
  styleGuide: Record<string, unknown> | null,
): string {
  if (!styleGuide) return basePrompt;

  const cam = styleGuide.camera as Record<string, string> | undefined;
  const env = styleGuide.environment as Record<string, string> | undefined;
  const subj = styleGuide.subject as Record<string, string> | undefined;
  const real = styleGuide.realism as Record<string, string> | undefined;

  const styleRules = [
    cam?.type && `Shot on ${cam.type}`,
    cam?.angle && `Camera ${cam.angle}`,
    cam?.quality && `${cam.quality}`,
    env?.lighting && `Lighting: ${env.lighting}`,
    env?.backgrounds && `Background: ${env.backgrounds}`,
    subj?.expression && `Expression: ${subj.expression}`,
    subj?.pose && `Pose: ${subj.pose}`,
    real?.texture && `Texture: ${real.texture}`,
    real?.priority && `IMPORTANT: ${real.priority}`,
    env?.avoid && `NEVER: ${env.avoid}`,
    real?.avoid && `AVOID: ${real.avoid}`,
  ].filter(Boolean);

  return `${basePrompt}\n\nStyle rules:\n${styleRules.join(". ")}`;
}

/**
 * Build a motion prompt for video generation using template mood/movement variations.
 * Matches the logic from the content-creation-app's generateVideo.ts.
 */
export function buildMotionPrompt(template: TemplateData): string {
  const movement = template.videoMovements.length > 0
    ? template.videoMovements[Math.floor(Math.random() * template.videoMovements.length)]
    : "nearly still, only natural breathing";

  const mood = template.videoMoods.length > 0
    ? template.videoMoods[Math.floor(Math.random() * template.videoMoods.length)]
    : "";

  return `Completely static camera. The person stares at the camera. Movement: ${movement}.${mood ? ` Energy: ${mood}.` : ""} Shot on phone, low light, grainy.`;
}

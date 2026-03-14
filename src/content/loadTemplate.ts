import path from "node:path";
import fs from "node:fs/promises";

/**
 * Template data loaded from the bundled templates directory.
 */
export interface TemplateData {
  name: string;
  /** Template-specific image prompt describing the scene/setting. */
  imagePrompt: string;
  /** Whether this template uses the artist's face-guide for identity. Defaults to true. */
  usesFaceGuide: boolean;
  styleGuide: Record<string, unknown> | null;
  captionGuide: Record<string, unknown> | null;
  captionExamples: string[];
  videoMoods: string[];
  videoMovements: string[];
  referenceImagePaths: string[];
}

/** Base path to the bundled templates directory. */
const TEMPLATES_DIR = path.resolve(__dirname, "../content/templates");

/**
 * Load all template data (style guide, caption guide, moods, movements, reference images).
 *
 * @param templateName
 */
export async function loadTemplate(templateName: string): Promise<TemplateData> {
  const templateDir = path.join(TEMPLATES_DIR, templateName);

  const styleGuide = await loadJsonFile<Record<string, unknown>>(
    path.join(templateDir, "style-guide.json"),
  );
  const captionGuide = await loadJsonFile<Record<string, unknown>>(
    path.join(templateDir, "caption-guide.json"),
  );
  const captionExamples =
    (await loadJsonFile<string[]>(
      path.join(templateDir, "references", "captions", "examples.json"),
    )) ?? [];
  const videoMoods =
    (await loadJsonFile<string[]>(path.join(templateDir, "video-moods.json"))) ?? [];
  const videoMovements =
    (await loadJsonFile<string[]>(path.join(templateDir, "video-movements.json"))) ?? [];

  // Discover reference images
  const imagesDir = path.join(templateDir, "references", "images");
  let referenceImagePaths: string[] = [];
  try {
    const files = await fs.readdir(imagesDir);
    referenceImagePaths = files
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
      .map(f => path.join(imagesDir, f));
  } catch {
    // No images directory
  }

  // Read template-level fields from the style guide
  const sg = styleGuide as Record<string, unknown> | null;
  const imagePrompt = (sg?.imagePrompt as string) ?? "";
  // Default to true — most templates use the artist's face
  const usesFaceGuide = (sg?.usesFaceGuide as boolean) ?? true;

  return {
    name: templateName,
    imagePrompt,
    usesFaceGuide,
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
 *
 * @param template
 */
export function pickRandomReferenceImage(template: TemplateData): string | null {
  if (template.referenceImagePaths.length === 0) return null;
  const idx = Math.floor(Math.random() * template.referenceImagePaths.length);
  return template.referenceImagePaths[idx];
}

/**
 * Build the full image prompt by combining the base prompt with the style guide rules.
 * Matches the logic from the content-creation-app's generateImage.ts.
 *
 * @param basePrompt
 * @param styleGuide
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
 *
 * @param template
 */
export function buildMotionPrompt(template: TemplateData): string {
  const movement =
    template.videoMovements.length > 0
      ? template.videoMovements[Math.floor(Math.random() * template.videoMovements.length)]
      : "nearly still, only natural breathing";

  const mood =
    template.videoMoods.length > 0
      ? template.videoMoods[Math.floor(Math.random() * template.videoMoods.length)]
      : "";

  return `Completely static camera. The person stares at the camera. Movement: ${movement}.${mood ? ` Energy: ${mood}.` : ""} Shot on phone, low light, grainy.`;
}

/**
 * Load a JSON file, returning null if it doesn't exist.
 *
 * @param filePath
 */
async function loadJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

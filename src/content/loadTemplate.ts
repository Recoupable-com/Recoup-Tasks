import path from "node:path";
import fs from "node:fs/promises";
import { logger } from "@trigger.dev/sdk/v3";

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

/**
 * Resolves the templates directory. Tries multiple strategies because
 * esbuild changes __dirname at bundle time:
 *   1. __dirname-relative (works locally with tsx)
 *   2. process.cwd()-relative (works in Trigger.dev deployments where
 *      additionalFiles preserves source-root-relative paths)
 */
async function resolveTemplatesDir(): Promise<string> {
  const candidates = [
    path.resolve(__dirname, "../content/templates"),
    path.resolve(process.cwd(), "src/content/templates"),
  ];

  for (const dir of candidates) {
    try {
      await fs.access(dir);
      return dir;
    } catch {
      // not found, try next
    }
  }

  logger.error("Template directory not found", {
    __dirname,
    cwd: process.cwd(),
    candidates,
  });
  throw new Error(
    `Templates directory not found. Tried: ${candidates.join(", ")}`,
  );
}

/**
 * Load all template data (style guide, caption guide, moods, movements, reference images).
 */
export async function loadTemplate(templateName: string): Promise<TemplateData> {
  const templatesDir = await resolveTemplatesDir();
  const templateDir = path.join(templatesDir, templateName);

  logger.log("loadTemplate: resolving paths", {
    __dirname,
    cwd: process.cwd(),
    templatesDir,
    templateDir,
  });

  // Check the template directory exists
  try {
    await fs.access(templateDir);
  } catch {
    logger.error("loadTemplate: template directory does not exist", {
      templateDir,
    });
    throw new Error(`Template directory not found: ${templateDir}`);
  }

  // List what's actually in the template directory
  const MAX_SAMPLE_FILES = 10;
  try {
    const entries = await fs.readdir(templateDir, { recursive: true });
    logger.log("loadTemplate: directory contents", {
      templateDir,
      totalFiles: entries.length,
      sampleFiles: entries.slice(0, MAX_SAMPLE_FILES),
      ...(entries.length > MAX_SAMPLE_FILES && { hasMore: true }),
    });
  } catch (err) {
    logger.error("loadTemplate: failed to list directory", {
      templateDir,
      error: String(err),
    });
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
    logger.log("loadTemplate: reference images found", {
      count: referenceImagePaths.length,
    });
  } catch {
    logger.warn("loadTemplate: no reference images directory", { imagesDir });
  }

  // Read template-level fields from the style guide
  const sg = styleGuide as Record<string, unknown> | null;
  const imagePrompt = (sg?.imagePrompt as string) ?? "";
  const usesFaceGuide = (sg?.usesFaceGuide as boolean) ?? true;

  logger.log("loadTemplate: result summary", {
    template: templateName,
    hasStyleGuide: styleGuide !== null,
    hasCaptionGuide: captionGuide !== null,
    captionExamplesCount: captionExamples.length,
    videoMoodsCount: videoMoods.length,
    videoMovementsCount: videoMovements.length,
    referenceImagesCount: referenceImagePaths.length,
    imagePromptLength: imagePrompt.length,
    usesFaceGuide,
  });

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

/**
 * Load a JSON file. Returns null if the file doesn't exist.
 * Rethrows parse errors and unexpected I/O failures so callers surface real bugs.
 */
async function loadJsonFile<T>(filePath: string, label: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as T;
    logger.log(`loadTemplate: loaded ${label}`, {
      path: filePath,
      sizeBytes: raw.length,
    });
    return parsed;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn(`loadTemplate: file not found ${label}`, { path: filePath });
      return null;
    }
    logger.warn(`loadTemplate: FAILED to load ${label}`, {
      path: filePath,
      error: String(err),
    });
    throw err;
  }
}

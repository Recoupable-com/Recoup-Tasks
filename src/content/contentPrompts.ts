/**
 * Default prompts for content creation pipeline.
 * These are based on the artist-caption-bedroom template style guide.
 * Future: prompts will be loaded from the template config dynamically.
 */

/**
 * Face-swap instruction — only used when the template requires the artist's face.
 * Tells the model how to use the two reference images:
 *   Image 1 (face-guide): headshot on white/plain background — the artist's identity
 *   Image 2 (reference): composition with a different person — the scene to recreate
 */
export const FACE_SWAP_INSTRUCTION = [
  "Replace the person in the scene with the person from the white background headshot.",
  "Use the face, hair, and features exactly as they appear in the headshot.",
  "Keep the setting from the reference photo but enhance it with the style rules below.",
  "The setting should feel real like the reference, but with the lighting and mood from the style guide.",
  "Remove any text, captions, watermarks, or overlays. The image should be clean with no text on it.",
].join(" ");

/** No-face instruction — for templates that don't use the artist's face. */
export const NO_FACE_INSTRUCTION = [
  "Remove any text, captions, watermarks, or overlays. The image should be clean with no text on it.",
].join(" ");

/** Default motion prompt — subtle movement for the video. */
export const DEFAULT_MOTION_PROMPT = [
  "Completely static camera.",
  "The person stares at the camera with a deadpan expression.",
  "Only natural breathing and very subtle micro-movements.",
  "Shot on phone, low light, grainy.",
].join(" ");

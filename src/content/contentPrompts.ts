/**
 * Default prompts for content creation pipeline.
 * These are based on the artist-caption-bedroom template style guide.
 * Future: prompts will be loaded from the template config dynamically.
 */

/** Default image prompt — creates a candid selfie-style portrait. */
export const DEFAULT_IMAGE_PROMPT = [
  "Candid front-facing selfie of a person in a dimly lit bedroom.",
  "Shot on front-facing phone camera, held slightly below face.",
  "Soft purple glow from LED strip, heavy shadows, grainy low-light photo.",
  "Real bedroom background — unmade bed, plain walls, clutter.",
  "Expression: deadpan, slightly bored, not smiling.",
  "Style rules: phone camera quality, slight noise and grain.",
  "Lighting: dim purple glow, most of the frame is dark.",
  "IMPORTANT: must look like a real phone photo, not AI-generated.",
  "AVOID: smooth skin, perfect hair, studio lighting, clean backgrounds.",
].join(" ");

/** Default motion prompt — subtle movement for the video. */
export const DEFAULT_MOTION_PROMPT = [
  "Completely static camera.",
  "The person stares at the camera with a deadpan expression.",
  "Only natural breathing and very subtle micro-movements.",
  "Shot on phone, low light, grainy.",
].join(" ");

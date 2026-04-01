import { FACE_SWAP_INSTRUCTION, NO_FACE_INSTRUCTION } from "./contentPrompts";
import type { TemplateData } from "./loadTemplate";

/**
 * Picks the image-generation instruction for the prompt.
 * Uses the template's customInstruction when available,
 * otherwise falls back to the default face-swap or no-face instruction.
 */
export function resolveImageInstruction(template: TemplateData): string {
  const custom = template.styleGuide?.customInstruction;
  if (typeof custom === "string" && custom.trim().length > 0) return custom.trim();
  return template.usesFaceGuide ? FACE_SWAP_INSTRUCTION : NO_FACE_INSTRUCTION;
}

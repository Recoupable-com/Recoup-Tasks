import { FACE_SWAP_INSTRUCTION, NO_FACE_INSTRUCTION } from "./contentPrompts";

/**
 * Picks the image-generation instruction for the prompt.
 * Uses the template's customInstruction when available,
 * otherwise falls back to the default face-swap or no-face instruction.
 */
export function resolveImageInstruction({
  styleGuide,
  usesFaceGuide,
}: {
  styleGuide: Record<string, unknown> | null;
  usesFaceGuide: boolean;
}): string {
  const custom = styleGuide?.customInstruction;
  if (typeof custom === "string" && custom.length > 0) return custom;
  return usesFaceGuide ? FACE_SWAP_INSTRUCTION : NO_FACE_INSTRUCTION;
}

import { describe, it, expect } from "vitest";
import { resolveImageInstruction } from "../resolveImageInstruction";
import { FACE_SWAP_INSTRUCTION, NO_FACE_INSTRUCTION } from "../contentPrompts";
import type { TemplateData } from "../loadTemplate";

function makeTemplate(overrides: Partial<TemplateData> = {}): TemplateData {
  return {
    name: "test",
    imagePrompt: "",
    usesFaceGuide: false,
    styleGuide: null,
    captionGuide: null,
    captionExamples: [],
    videoMoods: [],
    videoMovements: [],
    referenceImagePaths: [],
    ...overrides,
  };
}

describe("resolveImageInstruction", () => {
  it("uses customInstruction from style guide when present", () => {
    const result = resolveImageInstruction(
      makeTemplate({ styleGuide: { customInstruction: "Place the album art onto a vinyl sleeve." } }),
    );
    expect(result).toBe("Place the album art onto a vinyl sleeve.");
  });

  it("prepends face-swap instruction to customInstruction when usesFaceGuide is true", () => {
    const result = resolveImageInstruction(
      makeTemplate({ usesFaceGuide: true, styleGuide: { customInstruction: "Custom instruction here." } }),
    );
    expect(result).toContain(FACE_SWAP_INSTRUCTION);
    expect(result).toContain("Custom instruction here.");
    expect(result.indexOf(FACE_SWAP_INSTRUCTION)).toBeLessThan(result.indexOf("Custom instruction here."));
  });

  it("falls back to FACE_SWAP_INSTRUCTION when usesFaceGuide is true and no customInstruction", () => {
    const result = resolveImageInstruction(
      makeTemplate({ usesFaceGuide: true, styleGuide: {} }),
    );
    expect(result).toBe(FACE_SWAP_INSTRUCTION);
  });

  it("falls back to NO_FACE_INSTRUCTION when usesFaceGuide is false and no customInstruction", () => {
    const result = resolveImageInstruction(
      makeTemplate({ styleGuide: {} }),
    );
    expect(result).toBe(NO_FACE_INSTRUCTION);
  });

  it("falls back correctly when styleGuide is null", () => {
    const result = resolveImageInstruction(
      makeTemplate({ usesFaceGuide: true }),
    );
    expect(result).toBe(FACE_SWAP_INSTRUCTION);
  });

  it("treats whitespace-only customInstruction as empty", () => {
    const result = resolveImageInstruction(
      makeTemplate({ styleGuide: { customInstruction: "   " } }),
    );
    expect(result).toBe(NO_FACE_INSTRUCTION);
  });
});

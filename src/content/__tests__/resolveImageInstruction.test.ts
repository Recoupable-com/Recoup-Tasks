import { describe, it, expect } from "vitest";
import { resolveImageInstruction } from "../resolveImageInstruction";
import { FACE_SWAP_INSTRUCTION, NO_FACE_INSTRUCTION } from "../contentPrompts";

describe("resolveImageInstruction", () => {
  it("uses customInstruction from style guide when present", () => {
    const result = resolveImageInstruction({
      styleGuide: { customInstruction: "Place the album art onto a vinyl sleeve." },
      usesFaceGuide: false,
    });
    expect(result).toBe("Place the album art onto a vinyl sleeve.");
  });

  it("uses customInstruction even when usesFaceGuide is true", () => {
    const result = resolveImageInstruction({
      styleGuide: { customInstruction: "Custom instruction here." },
      usesFaceGuide: true,
    });
    expect(result).toBe("Custom instruction here.");
  });

  it("falls back to FACE_SWAP_INSTRUCTION when usesFaceGuide is true and no customInstruction", () => {
    const result = resolveImageInstruction({
      styleGuide: {},
      usesFaceGuide: true,
    });
    expect(result).toBe(FACE_SWAP_INSTRUCTION);
  });

  it("falls back to NO_FACE_INSTRUCTION when usesFaceGuide is false and no customInstruction", () => {
    const result = resolveImageInstruction({
      styleGuide: {},
      usesFaceGuide: false,
    });
    expect(result).toBe(NO_FACE_INSTRUCTION);
  });

  it("falls back correctly when styleGuide is null", () => {
    const result = resolveImageInstruction({
      styleGuide: null,
      usesFaceGuide: true,
    });
    expect(result).toBe(FACE_SWAP_INSTRUCTION);
  });
});

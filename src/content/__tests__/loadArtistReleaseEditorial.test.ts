import { describe, expect, it, vi } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

import { loadTemplate } from "../loadTemplate";

describe("loadTemplate artist-release-editorial", () => {
  it("loads the artist-release-editorial template", async () => {
    const template = await loadTemplate("artist-release-editorial");

    expect(template.name).toBe("artist-release-editorial");
    expect(template.imagePrompt).toBeTruthy();
    expect(template.usesFaceGuide).toBe(true);
    expect(template.styleGuide).not.toBeNull();
    expect(template.captionGuide).not.toBeNull();
    expect(template.videoMoods.length).toBeGreaterThan(0);
    expect(template.videoMovements.length).toBeGreaterThan(0);
    expect(template.captionExamples.length).toBeGreaterThan(0);
  });

  it("has a customInstruction in the style guide", async () => {
    const template = await loadTemplate("artist-release-editorial");
    const sg = template.styleGuide as Record<string, unknown>;

    expect(sg.customInstruction).toBeTruthy();
    expect(typeof sg.customInstruction).toBe("string");
  });
});

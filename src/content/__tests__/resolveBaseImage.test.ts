import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../../recoup/contentApi", () => ({
  generateImage: vi.fn(),
  upscaleMedia: vi.fn(),
}));

vi.mock("../loadTemplate", () => ({
  pickRandomReferenceImage: vi.fn().mockReturnValue("ref.png"),
  buildImagePrompt: vi.fn().mockReturnValue("full prompt"),
}));

vi.mock("../resolveImageInstruction", () => ({
  resolveImageInstruction: vi.fn().mockReturnValue("instruction"),
}));

const { generateImage, upscaleMedia } = await import("../../recoup/contentApi");
import { resolveBaseImage } from "../resolveBaseImage";
import type { TemplateData } from "../loadTemplate";

const template: TemplateData = {
  name: "t",
  imagePrompt: "prompt",
  usesFaceGuide: true,
  usesImageOverlay: false,
  styleGuide: null,
  captionGuide: null,
  captionExamples: [],
  videoMoods: [],
  videoMovements: [],
  referenceImagePaths: ["ref.png"],
};

describe("resolveBaseImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns editorialImageUrl directly and skips generation/upscale when provided", async () => {
    const result = await resolveBaseImage({
      editorialImageUrl: "https://fal.ai/editorial.png",
      faceGuideUrl: "https://fal.ai/face.png",
      additionalImageUrls: [],
      template,
      upscale: true,
    });

    expect(result).toBe("https://fal.ai/editorial.png");
    expect(generateImage).not.toHaveBeenCalled();
    expect(upscaleMedia).not.toHaveBeenCalled();
  });

  it("generates an image when no editorial image is provided", async () => {
    vi.mocked(generateImage).mockResolvedValue("https://fal.ai/generated.png");

    const result = await resolveBaseImage({
      editorialImageUrl: null,
      faceGuideUrl: "https://fal.ai/face.png",
      additionalImageUrls: [],
      template,
      upscale: false,
    });

    expect(result).toBe("https://fal.ai/generated.png");
    expect(generateImage).toHaveBeenCalledOnce();
    expect(upscaleMedia).not.toHaveBeenCalled();
  });

  it("upscales the generated image when upscale=true", async () => {
    vi.mocked(generateImage).mockResolvedValue("https://fal.ai/generated.png");
    vi.mocked(upscaleMedia).mockResolvedValue("https://fal.ai/generated-upscaled.png");

    const result = await resolveBaseImage({
      editorialImageUrl: null,
      faceGuideUrl: null,
      additionalImageUrls: [],
      template,
      upscale: true,
    });

    expect(result).toBe("https://fal.ai/generated-upscaled.png");
    expect(upscaleMedia).toHaveBeenCalledWith("https://fal.ai/generated.png", "image");
  });

  it("includes additionalImageUrls in imageRefs when template.usesImageOverlay is false", async () => {
    vi.mocked(generateImage).mockResolvedValue("https://fal.ai/generated.png");

    await resolveBaseImage({
      editorialImageUrl: null,
      faceGuideUrl: "https://fal.ai/face.png",
      additionalImageUrls: ["https://fal.ai/extra1.png", "https://fal.ai/extra2.png"],
      template: { ...template, usesImageOverlay: false },
      upscale: false,
    });

    const callArgs = vi.mocked(generateImage).mock.calls[0][0];
    expect(callArgs.images).toContain("https://fal.ai/extra1.png");
    expect(callArgs.images).toContain("https://fal.ai/extra2.png");
  });

  it("excludes additionalImageUrls from imageRefs when template.usesImageOverlay is true", async () => {
    vi.mocked(generateImage).mockResolvedValue("https://fal.ai/generated.png");

    await resolveBaseImage({
      editorialImageUrl: null,
      faceGuideUrl: "https://fal.ai/face.png",
      additionalImageUrls: ["https://fal.ai/extra1.png"],
      template: { ...template, usesImageOverlay: true },
      upscale: false,
    });

    const callArgs = vi.mocked(generateImage).mock.calls[0][0];
    expect(callArgs.images ?? []).not.toContain("https://fal.ai/extra1.png");
  });
});

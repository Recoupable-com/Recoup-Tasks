import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../fetchImageFromUrl", () => ({
  fetchImageFromUrl: vi.fn(),
}));

vi.mock("../classifyImage", () => ({
  classifyImage: vi.fn(),
}));

const { fetchImageFromUrl } = await import("../fetchImageFromUrl");
const { classifyImage } = await import("../classifyImage");

import { classifyImages } from "../classifyImages";

describe("classifyImages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("classifies face guide, editorial image, and additional images", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/editorial.png")
      .mockResolvedValueOnce("https://fal.ai/cover.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("face_guide")
      .mockResolvedValueOnce("editorial")
      .mockResolvedValueOnce("additional");

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/editorial.png",
        "https://example.com/cover.png",
      ],
      usesFaceGuide: true,
      usesEditorialImage: true,
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: "https://fal.ai/editorial.png",
      additionalImageUrls: ["https://fal.ai/cover.png"],
    });
  });

  it("treats editorial image as additional when usesEditorialImage is false", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/editorial.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("face_guide")
      .mockResolvedValueOnce("editorial");

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/editorial.png",
      ],
      usesFaceGuide: true,
      usesEditorialImage: false,
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/editorial.png"],
    });
  });

  it("returns null editorialImageUrl when no editorial image is found", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/cover.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("face_guide")
      .mockResolvedValueOnce("additional");

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/cover.png",
      ],
      usesFaceGuide: true,
      usesEditorialImage: true,
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/cover.png"],
    });
  });

  it("uses first editorial image found and puts rest in additionalImageUrls", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/editorial1.png")
      .mockResolvedValueOnce("https://fal.ai/editorial2.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("editorial")
      .mockResolvedValueOnce("editorial");

    const result = await classifyImages({
      images: [
        "https://example.com/photo1.png",
        "https://example.com/photo2.png",
      ],
      usesFaceGuide: false,
      usesEditorialImage: true,
    });

    expect(result).toEqual({
      faceGuideUrl: null,
      editorialImageUrl: "https://fal.ai/editorial1.png",
      additionalImageUrls: ["https://fal.ai/editorial2.png"],
    });
  });

  it("passes original input URL (not re-uploaded fal URL) to classifyImage", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://v3b.fal.media/files/uploaded1.png")
      .mockResolvedValueOnce("https://v3b.fal.media/files/uploaded2.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("additional")
      .mockResolvedValueOnce("additional");

    await classifyImages({
      images: [
        "https://blob.vercel-storage.com/original1.png",
        "https://blob.vercel-storage.com/original2.png",
      ],
      usesFaceGuide: true,
      usesEditorialImage: true,
    });

    expect(classifyImage).toHaveBeenCalledWith("https://blob.vercel-storage.com/original1.png");
    expect(classifyImage).toHaveBeenCalledWith("https://blob.vercel-storage.com/original2.png");
  });

  it("calls classifyImage exactly once per image (not twice like the old two-detector flow)", async () => {
    vi.mocked(fetchImageFromUrl).mockResolvedValue("https://fal.ai/x.png");
    vi.mocked(classifyImage).mockResolvedValue("additional");

    await classifyImages({
      images: ["https://example.com/a.png", "https://example.com/b.png", "https://example.com/c.png"],
      usesFaceGuide: true,
      usesEditorialImage: true,
    });

    expect(classifyImage).toHaveBeenCalledTimes(3);
  });

  it("handles empty images array", async () => {
    const result = await classifyImages({
      images: [],
      usesFaceGuide: true,
      usesEditorialImage: true,
    });

    expect(result).toEqual({
      faceGuideUrl: null,
      editorialImageUrl: null,
      additionalImageUrls: [],
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../fetchImageFromUrl", () => ({
  fetchImageFromUrl: vi.fn(),
}));

vi.mock("../detectFace", () => ({
  detectFace: vi.fn(),
}));

vi.mock("../detectEditorialImage", () => ({
  detectEditorialImage: vi.fn(),
}));

const { fetchImageFromUrl } = await import("../fetchImageFromUrl");
const { detectFace } = await import("../detectFace");
const { detectEditorialImage } = await import("../detectEditorialImage");

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
    vi.mocked(detectFace)
      .mockResolvedValueOnce(true);
    vi.mocked(detectEditorialImage)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/editorial.png",
        "https://example.com/cover.png",
      ],
      usesFaceGuide: true,
      usesImageOverlay: true,
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: "https://fal.ai/editorial.png",
      additionalImageUrls: ["https://fal.ai/cover.png"],
    });
  });

  it("does not run editorial detection when usesImageOverlay is false", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/img.png");
    vi.mocked(detectFace).mockResolvedValueOnce(true);

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/img.png",
      ],
      usesFaceGuide: true,
      usesImageOverlay: false,
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/img.png"],
    });
    expect(detectEditorialImage).not.toHaveBeenCalled();
  });

  it("returns null editorialImageUrl when no editorial image is found", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/cover.png");
    vi.mocked(detectFace).mockResolvedValueOnce(true);
    vi.mocked(detectEditorialImage).mockResolvedValueOnce(false);

    const result = await classifyImages({
      images: [
        "https://example.com/headshot.png",
        "https://example.com/cover.png",
      ],
      usesFaceGuide: true,
      usesImageOverlay: true,
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
    vi.mocked(detectEditorialImage)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const result = await classifyImages({
      images: [
        "https://example.com/photo1.png",
        "https://example.com/photo2.png",
      ],
      usesFaceGuide: false,
      usesImageOverlay: true,
    });

    expect(result).toEqual({
      faceGuideUrl: null,
      editorialImageUrl: "https://fal.ai/editorial1.png",
      additionalImageUrls: ["https://fal.ai/editorial2.png"],
    });
  });

  it("handles empty images array", async () => {
    const result = await classifyImages({
      images: [],
      usesFaceGuide: true,
      usesImageOverlay: true,
    });

    expect(result).toEqual({
      faceGuideUrl: null,
      editorialImageUrl: null,
      additionalImageUrls: [],
    });
  });
});

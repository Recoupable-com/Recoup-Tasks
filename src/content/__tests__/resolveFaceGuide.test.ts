import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveFaceGuide } from "../resolveFaceGuide";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../fetchImageFromUrl", () => ({
  fetchImageFromUrl: vi.fn(),
}));

vi.mock("../fetchGithubFile", () => ({
  fetchGithubFile: vi.fn(),
}));

vi.mock("../classifyImage", () => ({
  classifyImage: vi.fn(),
}));

vi.mock("@fal-ai/client", () => ({
  fal: { storage: { upload: vi.fn() } },
}));

const { fetchImageFromUrl } = await import("../fetchImageFromUrl");
const { fetchGithubFile } = await import("../fetchGithubFile");
const { classifyImage } = await import("../classifyImage");
const { fal } = await import("@fal-ai/client");

describe("resolveFaceGuide", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null faceGuideUrl, null editorialImageUrl, and empty additionalImageUrls when no images and usesFaceGuide is false", async () => {
    const result = await resolveFaceGuide({
      usesFaceGuide: false,
      usesEditorialImage: false,
      images: undefined,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({ faceGuideUrl: null, editorialImageUrl: null, additionalImageUrls: [] });
  });

  it("uses face image as faceGuideUrl and non-face images as additionalImageUrls", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face.png")
      .mockResolvedValueOnce("https://fal.ai/cover.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("face_guide")
      .mockResolvedValueOnce("additional");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      usesEditorialImage: false,
      images: [
        "https://example.com/headshot.png",
        "https://example.com/album-cover.png",
      ],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/cover.png"],
    });
  });

  it("falls back to GitHub face-guide when no images contain a face", async () => {
    vi.mocked(fetchImageFromUrl).mockResolvedValue("https://fal.ai/cover.png");
    vi.mocked(classifyImage).mockResolvedValue("additional");
    vi.mocked(fetchGithubFile).mockResolvedValue(Buffer.from("face-data"));
    vi.mocked(fal.storage.upload).mockResolvedValue("https://fal.ai/github-face.png");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      usesEditorialImage: false,
      images: ["https://example.com/album-cover.png"],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/github-face.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/cover.png"],
    });
  });

  it("puts all images in additionalImageUrls when usesFaceGuide is false", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/img1.png")
      .mockResolvedValueOnce("https://fal.ai/img2.png");

    const result = await resolveFaceGuide({
      usesFaceGuide: false,
      usesEditorialImage: false,
      images: ["https://example.com/a.png", "https://example.com/b.png"],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({
      faceGuideUrl: null,
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/img1.png", "https://fal.ai/img2.png"],
    });
    expect(classifyImage).not.toHaveBeenCalled();
  });

  it("fetches face-guide from GitHub when no images provided", async () => {
    vi.mocked(fetchGithubFile).mockResolvedValue(Buffer.from("face-data"));
    vi.mocked(fal.storage.upload).mockResolvedValue("https://fal.ai/github.png");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      usesEditorialImage: false,
      images: undefined,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/github.png",
      editorialImageUrl: null,
      additionalImageUrls: [],
    });
  });

  it("throws when usesFaceGuide is true and GitHub face-guide is not found", async () => {
    vi.mocked(fetchGithubFile).mockResolvedValue(null);

    await expect(
      resolveFaceGuide({
        usesFaceGuide: true,
        usesEditorialImage: false,
        images: undefined,
        githubRepo: "https://github.com/test/repo",
        artistSlug: "artist",
      }),
    ).rejects.toThrow("face-guide.png not found");
  });

  it("uses first face image when multiple faces are provided", async () => {
    vi.mocked(fetchImageFromUrl)
      .mockResolvedValueOnce("https://fal.ai/face1.png")
      .mockResolvedValueOnce("https://fal.ai/face2.png");
    vi.mocked(classifyImage)
      .mockResolvedValueOnce("face_guide")
      .mockResolvedValueOnce("face_guide");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      usesEditorialImage: false,
      images: [
        "https://example.com/headshot1.png",
        "https://example.com/headshot2.png",
      ],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toEqual({
      faceGuideUrl: "https://fal.ai/face1.png",
      editorialImageUrl: null,
      additionalImageUrls: ["https://fal.ai/face2.png"],
    });
  });
});

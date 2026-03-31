import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

vi.mock("@fal-ai/client", () => ({
  fal: { storage: { upload: vi.fn() } },
}));

const { fetchImageFromUrl } = await import("../fetchImageFromUrl");
const { fetchGithubFile } = await import("../fetchGithubFile");
const { fal } = await import("@fal-ai/client");

describe("resolveFaceGuide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when template does not use face guide", async () => {
    const result = await resolveFaceGuide({
      usesFaceGuide: false,
      images: ["https://example.com/face.png"],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(result).toBeNull();
    expect(fetchImageFromUrl).not.toHaveBeenCalled();
  });

  it("uses fetchImageFromUrl when images array has entries", async () => {
    vi.mocked(fetchImageFromUrl).mockResolvedValue("https://fal.ai/uploaded.png");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      images: ["https://example.com/face.png"],
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(fetchImageFromUrl).toHaveBeenCalledWith("https://example.com/face.png");
    expect(result).toBe("https://fal.ai/uploaded.png");
  });

  it("fetches from GitHub when no images provided", async () => {
    const buffer = Buffer.from("image-data");
    vi.mocked(fetchGithubFile).mockResolvedValue(buffer);
    vi.mocked(fal.storage.upload).mockResolvedValue("https://fal.ai/github.png");

    const result = await resolveFaceGuide({
      usesFaceGuide: true,
      images: undefined,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(fetchGithubFile).toHaveBeenCalledWith(
      "https://github.com/test/repo",
      "artists/artist/context/images/face-guide.png",
    );
    expect(result).toBe("https://fal.ai/github.png");
  });

  it("throws when GitHub face-guide is not found", async () => {
    vi.mocked(fetchGithubFile).mockResolvedValue(null);

    await expect(
      resolveFaceGuide({
        usesFaceGuide: true,
        images: undefined,
        githubRepo: "https://github.com/test/repo",
        artistSlug: "artist",
      }),
    ).rejects.toThrow("face-guide.png not found");
  });
});

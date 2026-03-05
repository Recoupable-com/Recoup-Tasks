import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockTagsAdd = vi.fn();

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn(), error: vi.fn() },
  metadata: { set: vi.fn() },
  tags: {
    add: (...args: unknown[]) => mockTagsAdd(...args),
  },
  schemaTask: (config: { run: unknown }) => {
    mockRun.mockImplementation(config.run as (...args: unknown[]) => unknown);
    return config;
  },
}));

const mockFalConfig = vi.fn();
const mockFalStorageUpload = vi.fn();
vi.mock("@fal-ai/client", () => ({
  fal: {
    config: (...args: unknown[]) => mockFalConfig(...args),
    storage: { upload: (...args: unknown[]) => mockFalStorageUpload(...args) },
  },
}));

const mockFetchGithubFile = vi.fn();
vi.mock("../../content/fetchGithubFile", () => ({
  fetchGithubFile: (...args: unknown[]) => mockFetchGithubFile(...args),
}));

const mockGenerateContentImage = vi.fn();
vi.mock("../../content/generateContentImage", () => ({
  generateContentImage: (...args: unknown[]) => mockGenerateContentImage(...args),
}));

const mockGenerateContentVideo = vi.fn();
vi.mock("../../content/generateContentVideo", () => ({
  generateContentVideo: (...args: unknown[]) => mockGenerateContentVideo(...args),
}));

await import("../createContentTask");

const VALID_PAYLOAD = {
  accountId: "acc_123",
  artistSlug: "gatsby-grace",
  template: "artist-caption-bedroom",
  lipsync: false,
  githubRepo: "https://github.com/recoupable/test-repo",
};

describe("createContentTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
  });

  it("runs full pipeline and returns video URL", async () => {
    mockFetchGithubFile.mockResolvedValue(Buffer.from("fake-png"));
    mockFalStorageUpload.mockResolvedValue("https://fal.storage/face-guide.png");
    mockGenerateContentImage.mockResolvedValue("https://fal.ai/generated-image.png");
    mockGenerateContentVideo.mockResolvedValue("https://fal.ai/generated-video.mp4");

    const result = await mockRun(VALID_PAYLOAD);

    expect(mockTagsAdd).toHaveBeenCalledWith("account:acc_123");
    expect(mockFetchGithubFile).toHaveBeenCalledWith(
      "https://github.com/recoupable/test-repo",
      "artists/gatsby-grace/context/images/face-guide.png",
    );
    expect(mockGenerateContentImage).toHaveBeenCalled();
    expect(mockGenerateContentVideo).toHaveBeenCalled();
    expect(result.videoSourceUrl).toBe("https://fal.ai/generated-video.mp4");
    expect(result.imageUrl).toBe("https://fal.ai/generated-image.png");
    expect(result.status).toBe("completed");
  });

  it("throws when face-guide is not found in repo", async () => {
    mockFetchGithubFile.mockResolvedValue(null);

    await expect(mockRun(VALID_PAYLOAD)).rejects.toThrow("face-guide.png not found");
  });

  it("throws when FAL_KEY is missing", async () => {
    delete process.env.FAL_KEY;

    await expect(mockRun(VALID_PAYLOAD)).rejects.toThrow("FAL_KEY");
  });
});

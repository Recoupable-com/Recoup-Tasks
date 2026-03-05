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

const mockSelectAudioClip = vi.fn();
vi.mock("../../content/selectAudioClip", () => ({
  selectAudioClip: (...args: unknown[]) => mockSelectAudioClip(...args),
}));

vi.mock("../../content/loadTemplate", () => ({
  loadTemplate: vi.fn().mockResolvedValue({
    name: "artist-caption-bedroom",
    styleGuide: null,
    captionGuide: null,
    captionExamples: [],
    videoMoods: [],
    videoMovements: [],
    referenceImagePaths: [],
  }),
  pickRandomReferenceImage: vi.fn().mockReturnValue(null),
  buildImagePrompt: vi.fn().mockReturnValue("test prompt"),
  buildMotionPrompt: vi.fn().mockReturnValue("test motion prompt"),
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

  it("runs full pipeline with audio and returns video URL", async () => {
    mockFetchGithubFile.mockResolvedValue(Buffer.from("fake-png"));
    mockFalStorageUpload.mockResolvedValue("https://fal.storage/face-guide.png");
    mockSelectAudioClip.mockResolvedValue({
      songFilename: "song.mp3",
      songTitle: "Test Song",
      songBuffer: Buffer.from("fake-mp3"),
      startSeconds: 30,
      durationSeconds: 8,
      lyrics: { title: "Test Song", fullLyrics: "lyrics", segments: [] },
      clipLyrics: "clip lyrics here",
      clipReason: "great hook",
      clipMood: "energetic",
    });
    mockGenerateContentImage.mockResolvedValue("https://fal.ai/image.png");
    mockGenerateContentVideo.mockResolvedValue("https://fal.ai/video.mp4");

    const result = await mockRun(VALID_PAYLOAD);

    expect(mockTagsAdd).toHaveBeenCalledWith("account:acc_123");
    expect(mockSelectAudioClip).toHaveBeenCalledWith(
      expect.objectContaining({
        githubRepo: "https://github.com/recoupable/test-repo",
        artistSlug: "gatsby-grace",
      }),
    );
    expect(result.videoSourceUrl).toBe("https://fal.ai/video.mp4");
    expect(result.audio.songTitle).toBe("Test Song");
    expect(result.audio.startSeconds).toBe(30);
    expect(result.audio.clipLyrics).toBe("clip lyrics here");
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

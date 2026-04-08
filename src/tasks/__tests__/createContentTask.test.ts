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

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../../content/fetchGithubFile", () => ({
  fetchGithubFile: vi.fn().mockResolvedValue(Buffer.from("fake-png")),
}));

vi.mock("../../content/downloadImageBuffer", () => ({
  downloadImageBuffer: vi.fn().mockResolvedValue({
    buffer: Buffer.from("fake-image"),
    contentType: "image/png",
  }),
}));

vi.mock("../../content/detectFace", () => ({
  detectFace: vi.fn().mockResolvedValue(false),
}));

vi.mock("../../content/generateContentImage", () => ({
  generateContentImage: vi.fn().mockResolvedValue("https://fal.ai/image.png"),
}));

vi.mock("../../content/generateContentVideo", () => ({
  generateContentVideo: vi.fn().mockResolvedValue("https://fal.ai/video.mp4"),
}));

vi.mock("../../content/generateAudioVideo", () => ({
  generateAudioVideo: vi.fn().mockResolvedValue("https://fal.ai/lipsync-video.mp4"),
}));

vi.mock("../../content/upscaleImage", () => ({
  upscaleImage: vi.fn().mockImplementation((url: string) => Promise.resolve(`${url}?upscaled`)),
}));

vi.mock("../../content/upscaleVideo", () => ({
  upscaleVideo: vi.fn().mockImplementation((url: string) => Promise.resolve(`${url}?upscaled`)),
}));

vi.mock("../../content/selectAudioClip", () => ({
  selectAudioClip: vi.fn().mockResolvedValue({
    songFilename: "song.mp3",
    songTitle: "Test Song",
    songBuffer: Buffer.from("fake-mp3"),
    startSeconds: 30,
    durationSeconds: 8,
    lyrics: { title: "Test Song", fullLyrics: "full lyrics", segments: [] },
    clipLyrics: "clip lyrics here",
    clipReason: "great hook",
    clipMood: "energetic",
  }),
}));

vi.mock("../../content/generateCaption", () => ({
  generateCaption: vi.fn().mockResolvedValue("this is the vibe 🎵"),
}));

vi.mock("../../content/fetchArtistContext", () => ({
  fetchArtistContext: vi.fn().mockResolvedValue("Artist identity info"),
}));

vi.mock("../../content/fetchAudienceContext", () => ({
  fetchAudienceContext: vi.fn().mockResolvedValue("Audience info"),
}));

vi.mock("../../content/renderFinalVideo", () => ({
  renderFinalVideo: vi.fn().mockResolvedValue({
    videoUrl: "https://fal.ai/storage/final-video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 5000,
  }),
}));

vi.mock("../../content/loadTemplate", () => ({
  loadTemplate: vi.fn().mockResolvedValue({
    name: "artist-caption-bedroom",
    imagePrompt: "test scene prompt",
    usesFaceGuide: true,
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
    mockFalStorageUpload.mockResolvedValue("https://fal.storage/face-guide.png");
  });

  it("runs full pipeline and returns final rendered video", async () => {
    const result = await mockRun(VALID_PAYLOAD);

    expect(mockTagsAdd).toHaveBeenCalledWith("account:acc_123");
    expect(result.status).toBe("completed");
    expect(result.videoSourceUrl).toBe("https://fal.ai/storage/final-video.mp4");
    expect(result.renderedVideoBytes).toBe(5000);
    expect(result.audio.songTitle).toBe("Test Song");
    expect(result.captionText).toBe("this is the vibe 🎵");
  });

  it("throws when face-guide is not found", async () => {
    const { fetchGithubFile } = await import("../../content/fetchGithubFile");
    vi.mocked(fetchGithubFile).mockResolvedValueOnce(null);

    await expect(mockRun(VALID_PAYLOAD)).rejects.toThrow("face-guide.png not found");
  });

  it("does not pass additionalImageUrls to generateContentImage when usesImageOverlay is true", async () => {
    const { loadTemplate } = await import("../../content/loadTemplate");
    vi.mocked(loadTemplate).mockResolvedValueOnce({
      name: "artist-release-editorial",
      imagePrompt: "editorial scene",
      usesFaceGuide: true,
      usesImageOverlay: true,
      styleGuide: { customInstruction: "Generate editorial photo." },
      captionGuide: null,
      captionExamples: [],
      videoMoods: [],
      videoMovements: [],
      referenceImagePaths: [],
    });

    await mockRun({
      ...VALID_PAYLOAD,
      template: "artist-release-editorial",
      images: ["https://example.com/cover1.png", "https://example.com/cover2.png"],
    });

    const { generateContentImage } = await import("../../content/generateContentImage");
    const callArgs = vi.mocked(generateContentImage).mock.calls[0][0];
    expect(callArgs.additionalImageUrls).toBeUndefined();
  });

  it("throws when FAL_KEY is missing", async () => {
    delete process.env.FAL_KEY;
    await expect(mockRun(VALID_PAYLOAD)).rejects.toThrow("FAL_KEY");
  });
});

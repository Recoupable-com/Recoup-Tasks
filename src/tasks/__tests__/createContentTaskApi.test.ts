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

vi.mock("../../sandboxes/logStep", () => ({ logStep: vi.fn() }));
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

// Mock the NEW API wrappers
const mockGenerateImage = vi.fn().mockResolvedValue("https://api.test/image.png");
const mockUpscaleMedia = vi.fn().mockImplementation((url: string) => Promise.resolve(`${url}?upscaled`));
const mockGenerateVideo = vi.fn().mockResolvedValue("https://api.test/video.mp4");
const mockGenerateCaption = vi.fn().mockResolvedValue("caption from api");

vi.mock("../../recoup/contentApi", () => ({
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
  upscaleMedia: (...args: unknown[]) => mockUpscaleMedia(...args),
  generateVideo: (...args: unknown[]) => mockGenerateVideo(...args),
  generateCaption: (...args: unknown[]) => mockGenerateCaption(...args),
}));

await import("../createContentTask");

const VALID_PAYLOAD = {
  accountId: "acc_123",
  artistSlug: "gatsby-grace",
  template: "artist-caption-bedroom",
  lipsync: false,
  githubRepo: "https://github.com/recoupable/test-repo",
};

describe("createContentTask (API integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    mockFalStorageUpload.mockResolvedValue("https://fal.storage/face-guide.png");
  });

  it("calls generateImage API instead of internal function", async () => {
    await mockRun(VALID_PAYLOAD);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.any(String) }),
    );
  });

  it("calls generateVideo API instead of internal function", async () => {
    await mockRun(VALID_PAYLOAD);
    expect(mockGenerateVideo).toHaveBeenCalledTimes(1);
    expect(mockGenerateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: expect.any(String),
        prompt: expect.any(String),
      }),
    );
  });

  it("calls generateCaption API instead of internal function", async () => {
    await mockRun(VALID_PAYLOAD);
    expect(mockGenerateCaption).toHaveBeenCalledTimes(1);
    expect(mockGenerateCaption).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: expect.any(String),
        template: "artist-caption-bedroom",
      }),
    );
  });

  it("calls upscaleMedia API for image when upscale=true", async () => {
    await mockRun({ ...VALID_PAYLOAD, upscale: true });
    expect(mockUpscaleMedia).toHaveBeenCalledWith(expect.any(String), "image");
  });

  it("calls upscaleMedia API for video when upscale=true", async () => {
    await mockRun({ ...VALID_PAYLOAD, upscale: true });
    expect(mockUpscaleMedia).toHaveBeenCalledWith(expect.any(String), "video");
  });

  it("does not call upscaleMedia when upscale=false", async () => {
    await mockRun({ ...VALID_PAYLOAD, upscale: false });
    expect(mockUpscaleMedia).not.toHaveBeenCalled();
  });

  it("passes audioUrl for lipsync mode", async () => {
    mockFalStorageUpload.mockResolvedValue("https://fal.storage/song.mp3");
    await mockRun({ ...VALID_PAYLOAD, lipsync: true });
    expect(mockGenerateVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: expect.any(String),
      }),
    );
  });

  it("returns completed result with API-generated content", async () => {
    const result = await mockRun(VALID_PAYLOAD);
    expect(result.status).toBe("completed");
    expect(result.imageUrl).toBe("https://api.test/image.png");
    expect(result.captionText).toBe("caption from api");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallRecoupApi = vi.fn();
vi.mock("../callRecoupApi", () => ({
  callRecoupApi: mockCallRecoupApi,
}));

describe("generateImage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /api/content/image with prompt and reference images", async () => {
    mockCallRecoupApi.mockResolvedValue({ imageUrl: "https://fal.media/img.png", images: ["https://fal.media/img.png"] });

    const { generateImage } = await import("../contentApi");
    const url = await generateImage({
      prompt: "a portrait photo",
      referenceImageUrl: "https://example.com/face.png",
      images: ["https://example.com/ref1.png"],
    });

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/image", {
      prompt: "a portrait photo",
      reference_image_url: "https://example.com/face.png",
      images: ["https://example.com/ref1.png"],
    });
    expect(url).toBe("https://fal.media/img.png");
  });

  it("filters out non-URL strings from images array", async () => {
    mockCallRecoupApi.mockResolvedValue({ imageUrl: "https://fal.media/img.png", images: ["https://fal.media/img.png"] });

    const { generateImage } = await import("../contentApi");
    await generateImage({
      prompt: "a portrait",
      images: ["https://example.com/valid.png", "references/images/local-path.png"],
    });

    const callArgs = mockCallRecoupApi.mock.calls[0][1] as Record<string, unknown>;
    const images = callArgs.images as string[];
    expect(images).toEqual(["https://example.com/valid.png"]);
  });
});

describe("upscaleMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /api/content/upscale for image", async () => {
    mockCallRecoupApi.mockResolvedValue({ url: "https://fal.media/upscaled.png" });

    const { upscaleMedia } = await import("../contentApi");
    const url = await upscaleMedia("https://example.com/img.png", "image");

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/upscale", {
      url: "https://example.com/img.png",
      type: "image",
    });
    expect(url).toBe("https://fal.media/upscaled.png");
  });

  it("calls POST /api/content/upscale for video", async () => {
    mockCallRecoupApi.mockResolvedValue({ url: "https://fal.media/upscaled.mp4" });

    const { upscaleMedia } = await import("../contentApi");
    const url = await upscaleMedia("https://example.com/vid.mp4", "video");

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/upscale", {
      url: "https://example.com/vid.mp4",
      type: "video",
    });
    expect(url).toBe("https://fal.media/upscaled.mp4");
  });
});

describe("generateVideo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /api/content/video with image_url and prompt", async () => {
    mockCallRecoupApi.mockResolvedValue({ videoUrl: "https://fal.media/vid.mp4", mode: "animate" });

    const { generateVideo } = await import("../contentApi");
    const url = await generateVideo({
      imageUrl: "https://example.com/img.png",
      prompt: "gentle breathing motion",
    });

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/video", {
      image_url: "https://example.com/img.png",
      prompt: "gentle breathing motion",
    });
    expect(url).toBe("https://fal.media/vid.mp4");
  });

  it("passes audio_url for lipsync mode", async () => {
    mockCallRecoupApi.mockResolvedValue({ videoUrl: "https://fal.media/vid.mp4", mode: "lipsync" });

    const { generateVideo } = await import("../contentApi");
    await generateVideo({
      imageUrl: "https://example.com/img.png",
      prompt: "singing",
      audioUrl: "https://example.com/song.mp3",
    });

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/video", {
      image_url: "https://example.com/img.png",
      prompt: "singing",
      audio_url: "https://example.com/song.mp3",
    });
  });
});

describe("generateCaption", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /api/content/caption with topic and template", async () => {
    mockCallRecoupApi
      .mockResolvedValueOnce({ templates: [{ id: "artist-caption-bedroom" }] })
      .mockResolvedValueOnce({ content: "midnight thoughts hit different" });

    const { generateCaption } = await import("../contentApi");
    const text = await generateCaption({
      topic: "heartbreak and late nights",
      template: "artist-caption-bedroom",
      length: "short",
    });

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/caption", {
      topic: "heartbreak and late nights",
      template: "artist-caption-bedroom",
      length: "short",
    });
    expect(text).toBe("midnight thoughts hit different");
  });

  it("omits template if not in API's template list", async () => {
    // First call: GET /api/content/templates returns the known list
    mockCallRecoupApi
      .mockResolvedValueOnce({ templates: [{ id: "artist-caption-bedroom" }, { id: "album-record-store" }] })
      // Second call: POST /api/content/caption
      .mockResolvedValueOnce({ content: "editorial caption" });

    const { generateCaption } = await import("../generateCaption");
    await generateCaption({
      topic: "album release",
      template: "artist-release-editorial",
      length: "short",
    });

    // Should have called templates API first, then caption without template
    expect(mockCallRecoupApi).toHaveBeenCalledTimes(2);
    const captionArgs = mockCallRecoupApi.mock.calls[1][1] as Record<string, unknown>;
    expect(captionArgs).not.toHaveProperty("template");
  });

  it("passes template when it exists in API's template list", async () => {
    mockCallRecoupApi
      .mockResolvedValueOnce({ templates: [{ id: "artist-caption-bedroom" }] })
      .mockResolvedValueOnce({ content: "bedroom vibes" });

    const { generateCaption } = await import("../generateCaption");
    await generateCaption({
      topic: "heartbreak",
      template: "artist-caption-bedroom",
      length: "short",
    });

    const captionArgs = mockCallRecoupApi.mock.calls[1][1] as Record<string, unknown>;
    expect(captionArgs.template).toBe("artist-caption-bedroom");
  });
});

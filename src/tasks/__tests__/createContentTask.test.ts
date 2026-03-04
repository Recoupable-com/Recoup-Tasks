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

const mockRenderContentVideo = vi.fn();
vi.mock("../../content/renderContentVideo", () => ({
  renderContentVideo: (...args: unknown[]) => mockRenderContentVideo(...args),
}));

await import("../createContentTask");

describe("createContentTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CONTENT_TEST_VIDEO_URL;
  });

  it("renders video and returns data URL output", async () => {
    mockRenderContentVideo.mockResolvedValue({
      dataUrl: "data:video/mp4;base64,AAA",
      mimeType: "video/mp4",
      sizeBytes: 1234,
    });

    const result = await mockRun({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
    });

    expect(mockTagsAdd).toHaveBeenCalledWith("account:acc_123");
    expect(result.videoSourceUrl).toBe("data:video/mp4;base64,AAA");
    expect(result.renderedVideoBytes).toBe(1234);
    expect(result.accountId).toBe("acc_123");
  });

  it("falls back to configured URL when render fails", async () => {
    process.env.CONTENT_TEST_VIDEO_URL = "https://example.com/fallback.mp4";
    mockRenderContentVideo.mockRejectedValue(new Error("ffmpeg failed"));

    const result = await mockRun({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: false,
    });

    expect(result.videoSourceUrl).toBe("https://example.com/fallback.mp4");
    expect(result.renderedVideoBytes).toBeNull();
  });
});


import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallRecoupApi = vi.fn();
vi.mock("../callRecoupApi", () => ({
  callRecoupApi: mockCallRecoupApi,
}));

describe("transcribeAudio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls POST /api/content/transcribe with audio_url", async () => {
    mockCallRecoupApi.mockResolvedValue({
      audioUrl: "https://example.com/song.mp3",
      fullLyrics: "hello world",
      segments: [{ start: 0, end: 1, text: "hello" }, { start: 1, end: 2, text: "world" }],
      segmentCount: 2,
    });

    const { transcribeAudio } = await import("../transcribeAudio");
    const result = await transcribeAudio("https://example.com/song.mp3");

    expect(mockCallRecoupApi).toHaveBeenCalledWith("/api/content/transcribe", {
      audio_urls: ["https://example.com/song.mp3"],
      language: "en",
      chunk_level: "word",
    });
    expect(result.fullLyrics).toBe("hello world");
    expect(result.segments).toHaveLength(2);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({ logStep: vi.fn() }));

const mockTranscribeAudio = vi.fn();
vi.mock("../../recoup/transcribeAudio", () => ({
  transcribeAudio: (...args: unknown[]) => mockTranscribeAudio(...args),
}));

vi.mock("../analyzeClips", () => ({
  analyzeClips: vi.fn().mockResolvedValue([{
    startSeconds: 30,
    lyrics: "test lyrics",
    reason: "good hook",
    mood: "energetic",
    hasLyrics: true,
  }]),
}));

vi.mock("../rankClips", () => ({
  rankClips: vi.fn().mockImplementation((clips) => clips),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("selectAttachedAudioClip uses API for transcription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(100),
    });
    mockTranscribeAudio.mockResolvedValue({
      audioUrl: "https://example.com/song.mp3",
      fullLyrics: "hello world lyrics",
      segments: [{ start: 0, end: 1, text: "hello" }, { start: 1, end: 2, text: "world" }],
      segmentCount: 2,
    });
  });

  it("calls transcribeAudio API with the audio URL instead of uploading buffer", async () => {
    const { selectAttachedAudioClip } = await import("../selectAttachedAudioClip");
    await selectAttachedAudioClip({
      audioUrl: "https://example.com/song.mp3",
      lipsync: false,
    });

    expect(mockTranscribeAudio).toHaveBeenCalledWith("https://example.com/song.mp3");
  });
});

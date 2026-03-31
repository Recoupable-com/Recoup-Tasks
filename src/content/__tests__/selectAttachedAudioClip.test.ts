import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { selectAttachedAudioClip } from "../selectAttachedAudioClip";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn() },
}));

vi.mock("../transcribeSong", () => ({
  transcribeSong: vi.fn(),
}));

vi.mock("../analyzeClips", () => ({
  analyzeClips: vi.fn(),
}));

vi.mock("../defaultPipelineConfig", () => ({
  DEFAULT_PIPELINE_CONFIG: { clipDuration: 15 },
}));

const { transcribeSong } = await import("../transcribeSong");
const { analyzeClips } = await import("../analyzeClips");

describe("selectAttachedAudioClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads audio from the provided URL", async () => {
    vi.mocked(transcribeSong).mockResolvedValue({
      title: "my-song",
      fullLyrics: "hello world",
      segments: [{ start: 0, end: 5, text: "hello world" }],
    });
    vi.mocked(analyzeClips).mockResolvedValue([
      { startSeconds: 0, lyrics: "hello", reason: "good", mood: "happy", hasLyrics: true },
    ]);

    await selectAttachedAudioClip({
      audioUrl: "https://blob.vercel-storage.com/song.mp3",
      lipsync: false,
    });

    expect(fetch).toHaveBeenCalledWith("https://blob.vercel-storage.com/song.mp3");
  });

  it("throws when download fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );

    await expect(
      selectAttachedAudioClip({
        audioUrl: "https://example.com/missing.mp3",
        lipsync: false,
      }),
    ).rejects.toThrow("Failed to download attached audio: 404 Not Found");
  });

  it("derives filename from URL path", async () => {
    vi.mocked(transcribeSong).mockResolvedValue({
      title: "my-track",
      fullLyrics: "",
      segments: [],
    });
    vi.mocked(analyzeClips).mockResolvedValue([]);

    const result = await selectAttachedAudioClip({
      audioUrl: "https://blob.vercel-storage.com/content-attachments/audio/my-track.mp3",
      lipsync: false,
    });

    expect(result.songFilename).toBe("my-track.mp3");
    expect(result.songTitle).toBe("my-track");
  });

  it("transcribes the downloaded audio", async () => {
    vi.mocked(transcribeSong).mockResolvedValue({
      title: "song",
      fullLyrics: "lyrics here",
      segments: [{ start: 0, end: 10, text: "lyrics here" }],
    });
    vi.mocked(analyzeClips).mockResolvedValue([
      { startSeconds: 0, lyrics: "lyrics", reason: "best", mood: "chill", hasLyrics: true },
    ]);

    const result = await selectAttachedAudioClip({
      audioUrl: "https://blob.vercel-storage.com/song.mp3",
      lipsync: false,
    });

    expect(transcribeSong).toHaveBeenCalledWith(expect.any(Buffer), "song.mp3");
    expect(result.lyrics.fullLyrics).toBe("lyrics here");
  });

  it("prefers clips with lyrics when lipsync is true", async () => {
    vi.mocked(transcribeSong).mockResolvedValue({
      title: "song",
      fullLyrics: "",
      segments: [],
    });
    vi.mocked(analyzeClips).mockResolvedValue([
      { startSeconds: 0, lyrics: "", reason: "instrumental", mood: "chill", hasLyrics: false },
      { startSeconds: 30, lyrics: "words", reason: "vocal", mood: "happy", hasLyrics: true },
    ]);

    const result = await selectAttachedAudioClip({
      audioUrl: "https://blob.vercel-storage.com/song.mp3",
      lipsync: true,
    });

    expect(result.startSeconds).toBe(30);
  });

  it("returns SelectedAudioClip interface shape", async () => {
    vi.mocked(transcribeSong).mockResolvedValue({
      title: "song",
      fullLyrics: "full lyrics",
      segments: [{ start: 0, end: 10, text: "clip text" }],
    });
    vi.mocked(analyzeClips).mockResolvedValue([
      { startSeconds: 0, lyrics: "clip", reason: "best clip", mood: "energetic", hasLyrics: true },
    ]);

    const result = await selectAttachedAudioClip({
      audioUrl: "https://blob.vercel-storage.com/song.mp3",
      lipsync: false,
    });

    expect(result).toMatchObject({
      songFilename: expect.any(String),
      songTitle: expect.any(String),
      songBuffer: expect.any(Buffer),
      startSeconds: expect.any(Number),
      durationSeconds: 15,
      lyrics: expect.any(Object),
      clipLyrics: expect.any(String),
      clipReason: expect.any(String),
      clipMood: expect.any(String),
    });
  });
});

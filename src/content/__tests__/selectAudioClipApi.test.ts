import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({ logStep: vi.fn() }));
vi.mock("@trigger.dev/sdk/v3", () => ({ logger: { log: vi.fn(), error: vi.fn() } }));

const mockTranscribeAudio = vi.fn();
vi.mock("../../recoup/transcribeAudio", () => ({
  transcribeAudio: (...args: unknown[]) => mockTranscribeAudio(...args),
}));

vi.mock("@fal-ai/client", () => ({
  fal: {
    storage: { upload: vi.fn().mockResolvedValue("https://fal.storage/uploaded-song.mp3") },
  },
}));

vi.mock("../fetchGithubFile", () => ({
  fetchGithubFile: vi.fn().mockResolvedValue(Buffer.from("fake-mp3")),
}));

vi.mock("../listArtistSongs", () => ({
  listArtistSongs: vi.fn().mockResolvedValue(["orgs/test/songs/song.mp3"]),
  parseSongPath: vi.fn().mockReturnValue({ repoUrl: null, filePath: "orgs/test/songs/song.mp3" }),
}));

vi.mock("../filterSongPaths", () => ({
  filterSongPaths: vi.fn().mockImplementation((paths) => paths),
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

describe("selectAudioClip uses API for transcription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTranscribeAudio.mockResolvedValue({
      audioUrl: "https://fal.storage/uploaded-song.mp3",
      fullLyrics: "hello world",
      segments: [{ start: 0, end: 1, text: "hello" }],
      segmentCount: 1,
    });
  });

  it("uploads buffer to fal storage then calls transcribeAudio API", async () => {
    const { selectAudioClip } = await import("../selectAudioClip");
    await selectAudioClip({
      githubRepo: "https://github.com/test/repo",
      artistSlug: "test-artist",
      lipsync: false,
    });

    expect(mockTranscribeAudio).toHaveBeenCalledWith("https://fal.storage/uploaded-song.mp3");
  });
});

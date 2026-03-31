import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveAudioClip } from "../resolveAudioClip";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("../selectAudioClip", () => ({
  selectAudioClip: vi.fn(),
}));

vi.mock("../selectAttachedAudioClip", () => ({
  selectAttachedAudioClip: vi.fn(),
}));

const { selectAudioClip } = await import("../selectAudioClip");
const { selectAttachedAudioClip } = await import("../selectAttachedAudioClip");

const mockClip = {
  songFilename: "song.mp3",
  songTitle: "song",
  songBuffer: Buffer.from("audio"),
  startSeconds: 0,
  durationSeconds: 15,
  lyrics: { title: "song", fullLyrics: "", segments: [] },
  clipLyrics: "",
  clipReason: "best",
  clipMood: "happy",
};

describe("resolveAudioClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses selectAttachedAudioClip when songs contain a URL", async () => {
    vi.mocked(selectAttachedAudioClip).mockResolvedValue(mockClip);

    const result = await resolveAudioClip({
      songs: ["hiccups", "https://example.com/track.mp3"],
      lipsync: false,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    });

    expect(selectAttachedAudioClip).toHaveBeenCalledWith({
      audioUrl: "https://example.com/track.mp3",
      lipsync: false,
    });
    expect(selectAudioClip).not.toHaveBeenCalled();
    expect(result).toBe(mockClip);
  });

  it("uses selectAudioClip when songs are all slugs", async () => {
    vi.mocked(selectAudioClip).mockResolvedValue(mockClip);

    const payload = {
      songs: ["hiccups", "adhd"],
      lipsync: true,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    };
    const result = await resolveAudioClip(payload);

    expect(selectAudioClip).toHaveBeenCalledWith(payload);
    expect(selectAttachedAudioClip).not.toHaveBeenCalled();
    expect(result).toBe(mockClip);
  });

  it("uses selectAudioClip when songs is undefined", async () => {
    vi.mocked(selectAudioClip).mockResolvedValue(mockClip);

    const payload = {
      songs: undefined,
      lipsync: false,
      githubRepo: "https://github.com/test/repo",
      artistSlug: "artist",
    };
    const result = await resolveAudioClip(payload);

    expect(selectAudioClip).toHaveBeenCalledWith(payload);
    expect(result).toBe(mockClip);
  });
});

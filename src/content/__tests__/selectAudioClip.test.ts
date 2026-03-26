import { describe, it, expect, vi, beforeEach } from "vitest";
import { selectAudioClip } from "../selectAudioClip";

// Mock all external dependencies
vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn() },
}));

vi.mock("../listArtistSongs", () => ({
  listArtistSongs: vi.fn(),
  parseSongPath: vi.fn((path: string) => ({ repoUrl: null, filePath: path })),
}));

vi.mock("../fetchGithubFile", () => ({
  fetchGithubFile: vi.fn(),
}));

vi.mock("../transcribeSong", () => ({
  transcribeSong: vi.fn(),
}));

vi.mock("../analyzeClips", () => ({
  analyzeClips: vi.fn(),
}));

import { listArtistSongs } from "../listArtistSongs";
import { fetchGithubFile } from "../fetchGithubFile";
import { transcribeSong } from "../transcribeSong";
import { analyzeClips } from "../analyzeClips";

const mockLyrics = {
  fullLyrics: "test lyrics",
  segments: [],
};

const mockClip = {
  startSeconds: 10,
  lyrics: "verse lyrics",
  reason: "good hook",
  mood: "upbeat",
  hasLyrics: true,
};

const allSongPaths = [
  "artists/test-artist/songs/adhd/adhd.mp3",
  "artists/test-artist/songs/hiccups/hiccups.mp3",
  "artists/test-artist/songs/junk-drawer/junk-drawer.mp3",
];

describe("selectAudioClip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchGithubFile).mockResolvedValue(Buffer.from("fake-mp3"));
    vi.mocked(transcribeSong).mockResolvedValue(mockLyrics);
    vi.mocked(analyzeClips).mockResolvedValue([mockClip]);
  });

  describe("song filtering", () => {
    it("picks from all songs when songs is omitted", async () => {
      vi.mocked(listArtistSongs).mockResolvedValue(allSongPaths);

      await selectAudioClip({
        githubRepo: "https://github.com/org/repo",
        artistSlug: "test-artist",
        clipDuration: 15,
        lipsync: false,
      });

      // listArtistSongs was called — all 3 are eligible
      expect(vi.mocked(listArtistSongs)).toHaveBeenCalledOnce();
    });

    it("filters to specified songs when songs array is provided", async () => {
      vi.mocked(listArtistSongs).mockResolvedValue(allSongPaths);

      await selectAudioClip({
        githubRepo: "https://github.com/org/repo",
        artistSlug: "test-artist",
        clipDuration: 15,
        lipsync: false,
        songs: ["adhd"],
      });

      // Only adhd.mp3 is eligible — transcribeSong should be called with adhd path
      expect(vi.mocked(fetchGithubFile)).toHaveBeenCalledWith(
        expect.any(String),
        "artists/test-artist/songs/adhd/adhd.mp3",
      );
    });

    it("throws when none of the specified songs are found", async () => {
      vi.mocked(listArtistSongs).mockResolvedValue(allSongPaths);

      await expect(
        selectAudioClip({
          githubRepo: "https://github.com/org/repo",
          artistSlug: "test-artist",
          clipDuration: 15,
          lipsync: false,
          songs: ["nonexistent-song"],
        }),
      ).rejects.toThrow("None of the specified songs [nonexistent-song] were found");
    });

    it("filters to multiple specified songs", async () => {
      vi.mocked(listArtistSongs).mockResolvedValue(allSongPaths);

      // Should not throw — both adhd and hiccups exist
      await expect(
        selectAudioClip({
          githubRepo: "https://github.com/org/repo",
          artistSlug: "test-artist",
          clipDuration: 15,
          lipsync: false,
          songs: ["adhd", "hiccups"],
        }),
      ).resolves.toBeDefined();
    });
  });
});

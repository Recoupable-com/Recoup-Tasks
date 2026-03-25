import { describe, it, expect, vi, beforeEach } from "vitest";
import { listArtistSongs } from "../listArtistSongs";

const mockFetch = vi.fn();
global.fetch = mockFetch;

process.env.GITHUB_TOKEN = "test-token";

function makeTreeResponse(paths: string[]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        tree: paths.map(path => ({ path, type: "blob" })),
      }),
  };
}

describe("listArtistSongs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only returns mp3s from the songs/ subdirectory", async () => {
    mockFetch.mockResolvedValueOnce(
      makeTreeResponse([
        "artists/gatsby-grace/songs/my-song/my-song.mp3",
        "artists/gatsby-grace/content/social-pack/assets/clip_bridge_15s.mp3",
        "artists/gatsby-grace/images/photo.jpg",
      ]),
    );

    const songs = await listArtistSongs("https://github.com/org/repo", "gatsby-grace");

    expect(songs).toEqual(["artists/gatsby-grace/songs/my-song/my-song.mp3"]);
  });

  it("excludes mp3s from content/ directory", async () => {
    // Main repo returns only content/ mp3s (no songs/)
    mockFetch.mockResolvedValueOnce(
      makeTreeResponse([
        "artists/gatsby-grace/content/social-pack-bedroom-lip-sync/assets/clip_bridge_15s.mp3",
      ]),
    );
    // Org submodules fetch (.gitmodules) returns no submodules
    mockFetch.mockResolvedValueOnce({ ok: false });

    const songs = await listArtistSongs("https://github.com/org/repo", "gatsby-grace");

    expect(songs).toEqual([]);
  });
});

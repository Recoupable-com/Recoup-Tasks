import { describe, it, expect, vi } from "vitest";
import { filterSongPaths } from "../filterSongPaths";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

describe("filterSongPaths", () => {
  const artistSlug = "gatsby-grace";

  it("keeps only paths matching the requested slugs", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
      "artists/gatsby-grace/songs/adhd/adhd.mp3",
      "artists/gatsby-grace/songs/freefall/freefall.mp3",
    ];

    const result = filterSongPaths(songPaths, ["hiccups", "adhd"], artistSlug);

    expect(result).toEqual([
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
      "artists/gatsby-grace/songs/adhd/adhd.mp3",
    ]);
  });

  it("uses exact matching — 'ad' does not match 'adhd'", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/adhd/adhd.mp3",
      "artists/gatsby-grace/songs/ad/ad.mp3",
    ];

    const result = filterSongPaths(songPaths, ["ad"], artistSlug);

    expect(result).toEqual([
      "artists/gatsby-grace/songs/ad/ad.mp3",
    ]);
  });

  it("throws when no songs match", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
    ];

    expect(() => filterSongPaths(songPaths, ["nonexistent"], artistSlug)).toThrow(
      "None of the specified songs [nonexistent] were found for artist gatsby-grace",
    );
  });

  it("handles case-insensitive slug matching", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/Hiccups/Hiccups.mp3",
    ];

    const result = filterSongPaths(songPaths, ["hiccups"], artistSlug);

    expect(result).toEqual([
      "artists/gatsby-grace/songs/Hiccups/Hiccups.mp3",
    ]);
  });

  it("trims whitespace from slugs", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
    ];

    const result = filterSongPaths(songPaths, [" hiccups "], artistSlug);

    expect(result).toEqual([
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
    ]);
  });

  it("returns all paths when songs is undefined", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
      "artists/gatsby-grace/songs/adhd/adhd.mp3",
    ];

    const result = filterSongPaths(songPaths, undefined, artistSlug);

    expect(result).toEqual(songPaths);
  });

  it("returns all paths when songs is empty", () => {
    const songPaths = [
      "artists/gatsby-grace/songs/hiccups/hiccups.mp3",
    ];

    const result = filterSongPaths(songPaths, [], artistSlug);

    expect(result).toEqual(songPaths);
  });

  it("works with org repo encoded paths", () => {
    const songPaths = [
      "__ORG_REPO__https://github.com/org/repo__artists/gatsby-grace/songs/hiccups/hiccups.mp3",
    ];

    const result = filterSongPaths(songPaths, ["hiccups"], artistSlug);

    expect(result).toEqual([songPaths[0]]);
  });
});

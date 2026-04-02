import { describe, it, expect } from "vitest";
import { parseSongClips } from "../parseSongClips";

describe("parseSongClips", () => {
  it("parses valid clip JSON with relatability scores", () => {
    const json = JSON.stringify([
      {
        startSeconds: 10,
        lyrics: "hello world",
        reason: "catchy",
        mood: "happy",
        hasLyrics: true,
        relatability: 8,
      },
    ]);

    const result = parseSongClips(json);
    expect(result).toHaveLength(1);
    expect(result[0].relatability).toBe(8);
  });

  it("rejects clips with relatability outside 1-10 range", () => {
    const json = JSON.stringify([
      {
        startSeconds: 0,
        lyrics: "test",
        reason: "test",
        mood: "test",
        hasLyrics: true,
        relatability: 15,
      },
    ]);

    const result = parseSongClips(json);
    expect(result).toHaveLength(0);
  });

  it("defaults relatability when missing", () => {
    const json = JSON.stringify([
      {
        startSeconds: 0,
        lyrics: "test",
        reason: "test",
        mood: "test",
        hasLyrics: true,
      },
    ]);

    const result = parseSongClips(json);
    expect(result[0].relatability).toBeUndefined();
  });

  it("coerces string numbers to actual numbers", () => {
    const json = JSON.stringify([
      {
        startSeconds: "10.5",
        lyrics: "test",
        reason: "test",
        mood: "test",
        hasLyrics: true,
        relatability: "7",
      },
    ]);

    const result = parseSongClips(json);
    expect(result[0].startSeconds).toBe(10.5);
    expect(result[0].relatability).toBe(7);
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseSongClips("not json at all");
    expect(result).toEqual([]);
  });

  it("filters out clips with negative startSeconds", () => {
    const json = JSON.stringify([
      {
        startSeconds: -5,
        lyrics: "test",
        reason: "test",
        mood: "test",
        hasLyrics: true,
      },
      {
        startSeconds: 10,
        lyrics: "valid",
        reason: "valid",
        mood: "valid",
        hasLyrics: true,
      },
    ]);

    const result = parseSongClips(json);
    expect(result).toHaveLength(1);
    expect(result[0].startSeconds).toBe(10);
  });
});

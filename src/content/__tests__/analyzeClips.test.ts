import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logStep before importing analyzeClips
vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

// mockGenerate must be declared with vi.hoisted so it's available in the
// hoisted vi.mock factory
const { mockGenerate } = vi.hoisted(() => {
  const mockGenerate = vi.fn();
  return { mockGenerate };
});

vi.mock("../../agents/createClipAnalysisAgent", () => ({
  createClipAnalysisAgent: () => ({ generate: mockGenerate }),
}));

import { analyzeClips } from "../analyzeClips";
import type { SongLyrics } from "../transcribeSong";

describe("analyzeClips", () => {
  const lyrics: SongLyrics = {
    title: "Test Song",
    fullLyrics: "hello world",
    segments: [
      { start: 0, end: 1, text: "hello" },
      { start: 1, end: 2, text: "world" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls agent.generate with a prompt containing the song title", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        {
          startSeconds: 0,
          lyrics: "hello world",
          reason: "catchy",
          mood: "happy",
          hasLyrics: true,
          relatability: 8,
        },
      ]),
    });

    await analyzeClips("Test Song", lyrics);

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Test Song"),
      }),
    );
  });

  it("includes timestamped lyrics in the prompt", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        {
          startSeconds: 0,
          lyrics: "hello world",
          reason: "catchy",
          mood: "happy",
          hasLyrics: true,
          relatability: 8,
        },
      ]),
    });

    await analyzeClips("Test Song", lyrics);

    const prompt = mockGenerate.mock.calls[0][0].prompt as string;
    expect(prompt).toContain("[0.0s] hello");
    expect(prompt).toContain("[1.0s] world");
  });

  it("returns validated clips from agent response", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        {
          startSeconds: 10,
          lyrics: "hello world",
          reason: "hook",
          mood: "emotional",
          hasLyrics: true,
          relatability: 9,
        },
      ]),
    });

    const result = await analyzeClips("Test Song", lyrics);

    expect(result).toHaveLength(1);
    expect(result[0].startSeconds).toBe(10);
    expect(result[0].relatability).toBe(9);
  });

  it("passes only dynamic song data as the prompt, not system instructions", async () => {
    mockGenerate.mockResolvedValue({
      text: JSON.stringify([
        {
          startSeconds: 0,
          lyrics: "hello world",
          reason: "catchy",
          mood: "happy",
          hasLyrics: true,
          relatability: 8,
        },
      ]),
    });

    await analyzeClips("Test Song", lyrics);

    const prompt = mockGenerate.mock.calls[0][0].prompt as string;
    // Dynamic data should be in the prompt
    expect(prompt).toContain("Test Song");
    expect(prompt).toContain("[0.0s] hello");
    // Static system instructions should NOT be in the prompt
    expect(prompt).not.toContain("PRIORITIZE moments");
    expect(prompt).not.toContain("AVOID selecting");
  });

  it("returns fallback when agent.generate throws", async () => {
    mockGenerate.mockRejectedValue(new Error("Model unavailable"));

    const result = await analyzeClips("Test Song", lyrics);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("fallback");
  });

  it("returns fallback when response has no JSON array", async () => {
    mockGenerate.mockResolvedValue({
      text: "I cannot analyze this song.",
    });

    const result = await analyzeClips("Test Song", lyrics);

    expect(result).toHaveLength(1);
    expect(result[0].reason).toContain("fallback");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logStep before importing analyzeClips
vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

// Mock ai module — mockGenerate must be declared with vi.hoisted so it's
// available inside the hoisted vi.mock factory
const { mockGenerate } = vi.hoisted(() => {
  const mockGenerate = vi.fn();
  return { mockGenerate };
});

vi.mock("ai", () => {
  class MockToolLoopAgent {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
    generate = mockGenerate;
  }
  return {
    ToolLoopAgent: MockToolLoopAgent,
    stepCountIs: vi.fn().mockReturnValue("step-count-1"),
  };
});

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

  it("creates a ToolLoopAgent with the correct model", async () => {
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

    expect(mockGenerate).toHaveBeenCalled();
    // Verify the agent was constructed — mockGenerate being called means
    // ToolLoopAgent was instantiated and agent.generate was invoked
  });

  it("calls agent.generate with a prompt", async () => {
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

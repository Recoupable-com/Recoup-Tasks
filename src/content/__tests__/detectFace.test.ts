import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const mockGenerate = vi.fn();
vi.mock("../../agents/createFaceDetectionAgent", () => ({
  createFaceDetectionAgent: () => ({
    generate: mockGenerate,
  }),
}));

import { detectFace } from "../detectFace";

describe("detectFace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the agent detects a face", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: true } });

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
  });

  it("returns false when the agent detects no face", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: false } });

    const result = await detectFace("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("passes the image URL in the prompt", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: true } });

    await detectFace("https://example.com/photo.png");

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("https://example.com/photo.png"),
      }),
    );
  });

  it("returns false when the agent throws", async () => {
    mockGenerate.mockRejectedValue(new Error("Model error"));

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });

  it("logs the error when detection fails", async () => {
    const { logStep } = await import("../../sandboxes/logStep");
    mockGenerate.mockRejectedValue(new Error("Rate limit exceeded"));

    await detectFace("https://example.com/broken.png");

    expect(logStep).toHaveBeenCalledWith(
      "Face detection failed, assuming no face",
      false,
      expect.objectContaining({ error: "Rate limit exceeded" }),
    );
  });

  it("returns false when output is null", async () => {
    mockGenerate.mockResolvedValue({ output: null });

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const mockGenerate = vi.fn();
vi.mock("../../agents/createEditorialDetectionAgent", () => ({
  createEditorialDetectionAgent: () => ({
    generate: mockGenerate,
  }),
}));

import { detectEditorialImage } from "../detectEditorialImage";

describe("detectEditorialImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when the agent detects an editorial photo", async () => {
    mockGenerate.mockResolvedValue({ output: { isEditorial: true } });

    const result = await detectEditorialImage("https://example.com/press-photo.png");

    expect(result).toBe(true);
  });

  it("returns false when the agent detects a non-editorial image", async () => {
    mockGenerate.mockResolvedValue({ output: { isEditorial: false } });

    const result = await detectEditorialImage("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("sends reference editorial images in a few-shot prompt", async () => {
    mockGenerate.mockResolvedValue({ output: { isEditorial: true } });

    await detectEditorialImage("https://example.com/photo.png");

    const callArgs = mockGenerate.mock.calls[0][0];
    const messages = callArgs.messages;

    // First message: reference editorial examples + question
    expect(messages[0].role).toBe("user");
    const imageParts = messages[0].content.filter((p: { type: string }) => p.type === "image");
    expect(imageParts.length).toBeGreaterThan(0);

    // Second message: assistant answer for the example
    expect(messages[1].role).toBe("assistant");

    // Third message: actual image to classify
    expect(messages[2].role).toBe("user");
    const targetImagePart = messages[2].content.find((p: { type: string }) => p.type === "image");
    expect(targetImagePart.image).toBe("https://example.com/photo.png");
  });

  it("returns false when the agent throws", async () => {
    mockGenerate.mockRejectedValue(new Error("Model error"));

    const result = await detectEditorialImage("https://example.com/broken.png");

    expect(result).toBe(false);
  });

  it("logs the error when detection fails", async () => {
    const { logStep } = await import("../../sandboxes/logStep");
    mockGenerate.mockRejectedValue(new Error("Rate limit exceeded"));

    await detectEditorialImage("https://example.com/broken.png");

    expect(logStep).toHaveBeenCalledWith(
      "Editorial detection failed, assuming false",
      false,
      expect.objectContaining({ error: "Rate limit exceeded" }),
    );
  });

  it("returns false when output is null", async () => {
    mockGenerate.mockResolvedValue({ output: null });

    const result = await detectEditorialImage("https://example.com/broken.png");

    expect(result).toBe(false);
  });
});

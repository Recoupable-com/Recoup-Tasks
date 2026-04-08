import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn().mockReturnValue(Buffer.from("fake-face-guide-png")),
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

  it("returns true when the agent detects a face guide", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: true } });

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
  });

  it("returns false when the agent detects no face guide", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: false } });

    const result = await detectFace("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("sends a few-shot example with the face guide reference image", async () => {
    mockGenerate.mockResolvedValue({ output: { hasFace: true } });

    await detectFace("https://example.com/photo.png");

    const callArgs = mockGenerate.mock.calls[0][0];
    const messages = callArgs.messages;

    // First message: example face guide image + question
    expect(messages[0].role).toBe("user");
    const exampleImagePart = messages[0].content.find((p: { type: string }) => p.type === "image");
    expect(exampleImagePart).toBeDefined();

    // Second message: assistant answer for the example
    expect(messages[1].role).toBe("assistant");

    // Third message: actual image to classify
    expect(messages[2].role).toBe("user");
    const targetImagePart = messages[2].content.find((p: { type: string }) => p.type === "image");
    expect(targetImagePart.image).toBe("https://example.com/photo.png");
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

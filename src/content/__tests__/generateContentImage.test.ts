import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  default: { readFile: vi.fn() },
}));

vi.mock("@fal-ai/client", () => ({
  fal: {
    storage: { upload: vi.fn() },
  },
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn() },
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

const mockFalSubscribe = vi.fn();
vi.mock("../falSubscribe", () => ({
  falSubscribe: (...args: unknown[]) => mockFalSubscribe(...args),
}));

import fs from "node:fs/promises";
import { fal } from "@fal-ai/client";
import { generateContentImage } from "../generateContentImage";

describe("generateContentImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFalSubscribe.mockResolvedValue({
      data: { images: [{ url: "https://fal.ai/generated.png" }] },
    });
  });

  it("passes face guide and reference image to fal", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("ref-image"));
    vi.mocked(fal.storage.upload).mockResolvedValue("https://fal.ai/ref.png");

    await generateContentImage({
      faceGuideUrl: "https://fal.ai/face.png",
      referenceImagePath: "/path/to/ref-01.png",
      prompt: "test prompt",
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual([
      "https://fal.ai/face.png",
      "https://fal.ai/ref.png",
    ]);
  });

  it("includes additionalImageUrls in image_urls after face guide and reference", async () => {
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from("ref-image"));
    vi.mocked(fal.storage.upload).mockResolvedValue("https://fal.ai/ref.png");

    await generateContentImage({
      faceGuideUrl: "https://fal.ai/face.png",
      referenceImagePath: "/path/to/ref-01.png",
      prompt: "test prompt",
      additionalImageUrls: [
        "https://example.com/album-cover.png",
        "https://example.com/playlist-cover.png",
      ],
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual([
      "https://fal.ai/face.png",
      "https://fal.ai/ref.png",
      "https://example.com/album-cover.png",
      "https://example.com/playlist-cover.png",
    ]);
  });

  it("works with additionalImageUrls but no face guide or reference", async () => {
    await generateContentImage({
      referenceImagePath: null,
      prompt: "test prompt",
      additionalImageUrls: ["https://example.com/cover.png"],
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual(["https://example.com/cover.png"]);
  });

  it("deduplicates additionalImageUrls that match faceGuideUrl", async () => {
    await generateContentImage({
      faceGuideUrl: "https://fal.ai/face.png",
      referenceImagePath: null,
      prompt: "test prompt",
      additionalImageUrls: ["https://fal.ai/face.png", "https://example.com/cover.png"],
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual([
      "https://fal.ai/face.png",
      "https://example.com/cover.png",
    ]);
  });

  it("ignores empty additionalImageUrls array", async () => {
    await generateContentImage({
      faceGuideUrl: "https://fal.ai/face.png",
      referenceImagePath: null,
      prompt: "test prompt",
      additionalImageUrls: [],
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual(["https://fal.ai/face.png"]);
  });

  it("deduplicates within additionalImageUrls itself", async () => {
    await generateContentImage({
      referenceImagePath: null,
      prompt: "test prompt",
      additionalImageUrls: [
        "https://example.com/cover.png",
        "https://example.com/cover.png",
        "https://example.com/other.png",
      ],
    });

    const callArgs = mockFalSubscribe.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs.image_urls).toEqual([
      "https://example.com/cover.png",
      "https://example.com/other.png",
    ]);
  });
});

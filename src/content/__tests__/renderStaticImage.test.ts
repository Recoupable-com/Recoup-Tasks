import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../downloadMediaToFile", () => ({
  downloadMediaToFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../downloadOverlayImages", () => ({
  downloadOverlayImages: vi.fn().mockResolvedValue(["/tmp/ovr-0.png"]),
}));

vi.mock("../runFfmpeg", () => ({
  runFfmpeg: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../uploadToFalStorage", () => ({
  uploadToFalStorage: vi.fn().mockResolvedValue({
    url: "https://fal.ai/static-image.png",
    mimeType: "image/png",
    sizeBytes: 12345,
  }),
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

import { renderStaticImage } from "../renderStaticImage";
import { runFfmpeg } from "../runFfmpeg";
import { uploadToFalStorage } from "../uploadToFalStorage";
import { downloadOverlayImages } from "../downloadOverlayImages";
import { downloadMediaToFile } from "../downloadMediaToFile";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("renderStaticImage", () => {
  it("returns the uploaded image URL and size", async () => {
    const result = await renderStaticImage({
      imageUrl: "https://example.com/base.png",
      overlayImageUrls: ["https://example.com/cover.png"],
    });

    expect(result).toEqual({
      imageUrl: "https://fal.ai/static-image.png",
      mimeType: "image/png",
      sizeBytes: 12345,
    });
  });

  it("downloads the base image to a temp file", async () => {
    await renderStaticImage({
      imageUrl: "https://example.com/base.png",
      overlayImageUrls: [],
    });

    expect(downloadMediaToFile).toHaveBeenCalledWith(
      "https://example.com/base.png",
      expect.stringContaining("base-image.png"),
    );
  });

  it("downloads overlay images", async () => {
    await renderStaticImage({
      imageUrl: "https://example.com/base.png",
      overlayImageUrls: ["https://example.com/a.png", "https://example.com/b.png"],
    });

    expect(downloadOverlayImages).toHaveBeenCalledWith(
      ["https://example.com/a.png", "https://example.com/b.png"],
      expect.any(String),
    );
  });

  it("calls runFfmpeg with args", async () => {
    await renderStaticImage({
      imageUrl: "https://example.com/base.png",
      overlayImageUrls: ["https://example.com/cover.png"],
    });

    expect(runFfmpeg).toHaveBeenCalledTimes(1);
    const args = vi.mocked(runFfmpeg).mock.calls[0][0];
    expect(args).toContain("-y");
  });

  it("uploads the output as image/png", async () => {
    await renderStaticImage({
      imageUrl: "https://example.com/base.png",
      overlayImageUrls: [],
    });

    expect(uploadToFalStorage).toHaveBeenCalledWith(
      expect.stringContaining("static-image.png"),
      "static-image.png",
      "image/png",
    );
  });
});

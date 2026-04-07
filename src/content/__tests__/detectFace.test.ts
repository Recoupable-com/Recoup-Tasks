import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  logger: { log: vi.fn() },
}));

const mockFalSubscribe = vi.fn();
vi.mock("../falSubscribe", () => ({
  falSubscribe: (...args: unknown[]) => mockFalSubscribe(...args),
}));

import { detectFace } from "../detectFace";

describe("detectFace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when a person label is detected", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: {
        results: {
          bboxes: [[10, 20, 100, 200]],
          labels: ["person"],
        },
      },
    });

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
    expect(mockFalSubscribe).toHaveBeenCalledWith(
      "fal-ai/florence-2-large/object-detection",
      { image_url: "https://example.com/headshot.png" },
    );
  });

  it("returns true when a face label is detected among other objects", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: {
        results: {
          bboxes: [[0, 0, 50, 50], [10, 20, 100, 200]],
          labels: ["chair", "human face"],
        },
      },
    });

    const result = await detectFace("https://example.com/photo.png");

    expect(result).toBe(true);
  });

  it("returns false when no person or face labels are detected", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: {
        results: {
          bboxes: [[0, 0, 300, 300]],
          labels: ["album cover"],
        },
      },
    });

    const result = await detectFace("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("returns false when results are empty", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: {
        results: {
          bboxes: [],
          labels: [],
        },
      },
    });

    const result = await detectFace("https://example.com/blank.png");

    expect(result).toBe(false);
  });

  it("returns false when detection fails", async () => {
    mockFalSubscribe.mockRejectedValue(new Error("Detection failed"));

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });
});

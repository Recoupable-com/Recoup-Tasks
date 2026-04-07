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

  it("returns true when faces are detected", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: { faces: [{ bbox: [0, 0, 100, 100] }] },
    });

    const result = await detectFace("https://example.com/headshot.png");

    expect(result).toBe(true);
  });

  it("returns false when no faces are detected", async () => {
    mockFalSubscribe.mockResolvedValue({
      data: { faces: [] },
    });

    const result = await detectFace("https://example.com/album-cover.png");

    expect(result).toBe(false);
  });

  it("returns false when face detection fails", async () => {
    mockFalSubscribe.mockRejectedValue(new Error("Detection failed"));

    const result = await detectFace("https://example.com/broken.png");

    expect(result).toBe(false);
  });
});

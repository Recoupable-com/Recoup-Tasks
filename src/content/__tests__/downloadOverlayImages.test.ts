import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(),
}));

import { downloadOverlayImages } from "../downloadOverlayImages";

describe("downloadOverlayImages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("skips failed downloads without aborting remaining images", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    // First fetch throws a network error
    fetchSpy.mockRejectedValueOnce(new Error("DNS resolution failed"));

    // Second fetch succeeds
    fetchSpy.mockResolvedValueOnce(
      new Response(new ArrayBuffer(8), { status: 200 }),
    );

    const result = await downloadOverlayImages(
      ["https://example.com/fail.png", "https://example.com/ok.png"],
      "/tmp/test",
    );

    // Should have one successful path, not zero (which would happen if exception aborted the loop)
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("overlay-1.png");
  });
});

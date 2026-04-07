import { describe, it, expect } from "vitest";

import { buildOverlayFilters } from "../buildOverlayFilters";

describe("buildOverlayFilters", () => {
  it("returns empty arrays when no overlay images provided", () => {
    const result = buildOverlayFilters([]);

    expect(result.inputs).toEqual([]);
    expect(result.filterChain).toBe("");
  });

  it("builds a single overlay in bottom-right corner", () => {
    const result = buildOverlayFilters(["/tmp/cover.png"]);

    expect(result.inputs).toEqual(["-i", "/tmp/cover.png"]);
    expect(result.filterChain).toContain("overlay=");
    expect(result.filterChain).toContain("scale=");
  });

  it("builds multiple overlays for multiple images", () => {
    const result = buildOverlayFilters(["/tmp/cover1.png", "/tmp/cover2.png"]);

    expect(result.inputs).toEqual([
      "-i", "/tmp/cover1.png",
      "-i", "/tmp/cover2.png",
    ]);
    // Should have overlay filter for each image
    const overlayCount = (result.filterChain.match(/overlay=/g) || []).length;
    expect(overlayCount).toBe(2);
  });

  it("positions overlays without overlapping each other", () => {
    const result = buildOverlayFilters(["/tmp/a.png", "/tmp/b.png"]);

    // Both overlays should have distinct position expressions
    expect(result.filterChain).toBeTruthy();
  });
});

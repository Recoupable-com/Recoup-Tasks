import { describe, it, expect } from "vitest";

import { buildOverlayFilters } from "../buildOverlayFilters";

describe("buildOverlayFilters", () => {
  it("returns empty arrays when no overlay images provided", () => {
    const result = buildOverlayFilters([]);

    expect(result.inputs).toEqual([]);
    expect(result.filterChain).toBe("");
  });

  it("builds a single overlay in the top-left corner", () => {
    const result = buildOverlayFilters(["/tmp/cover.png"]);

    expect(result.inputs).toEqual(["-i", "/tmp/cover.png"]);
    expect(result.filterChain).toContain("overlay=");
    expect(result.filterChain).toContain("scale=");
    // Top-left: x should be small (edge padding), y should be small
    expect(result.filterChain).toMatch(/overlay=30:30/);
  });

  it("stacks multiple overlays vertically from top-left", () => {
    const result = buildOverlayFilters(["/tmp/cover1.png", "/tmp/cover2.png"]);

    expect(result.inputs).toEqual([
      "-i", "/tmp/cover1.png",
      "-i", "/tmp/cover2.png",
    ]);
    const overlayCount = (result.filterChain.match(/overlay=/g) || []).length;
    expect(overlayCount).toBe(2);
    // First at y=30, second at y=30+150+20=200
    expect(result.filterChain).toMatch(/overlay=30:30/);
    expect(result.filterChain).toMatch(/overlay=30:200/);
  });

  it("caps overlays at MAX_OVERLAYS to prevent off-frame rendering", () => {
    const paths = Array.from({ length: 10 }, (_, i) => `/tmp/cover${i}.png`);
    const result = buildOverlayFilters(paths);

    const overlayCount = (result.filterChain.match(/overlay=/g) || []).length;
    expect(overlayCount).toBeLessThanOrEqual(6);
  });
});

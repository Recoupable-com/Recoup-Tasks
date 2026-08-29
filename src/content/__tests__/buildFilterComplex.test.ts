import { describe, it, expect } from "vitest";

import { buildFilterComplex } from "../buildFilterComplex";

describe("buildFilterComplex", () => {
  it("builds crop + scale + overlay + caption pipeline", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: ["drawtext=text='hello':fontsize=42"],
    });

    expect(result).toContain("[0:v]crop=ih*9/16:ih,scale=720:1280[video_base]");
    expect(result).toContain("[1:v]scale=150:150[ovr_0]");
    expect(result).toContain("overlay=30:30");
    expect(result).toContain("[out]");
  });

  it("positions overlays in top-left stacked vertically", () => {
    const result = buildFilterComplex({
      overlayCount: 2,
      captionFilters: ["drawtext=text='hi':fontsize=42"],
    });

    expect(result).toMatch(/overlay=30:30/);
    expect(result).toMatch(/overlay=30:200/);
  });

  it("chains multiple overlays correctly", () => {
    const result = buildFilterComplex({
      overlayCount: 3,
      captionFilters: [],
    });

    const overlayCount = (result.match(/overlay=/g) || []).length;
    expect(overlayCount).toBe(3);
  });

  it("emits [out] label when captionFilters is empty", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: [],
    });

    expect(result).toContain("[out]");
  });

  it("positions overlays in top-right when specified", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: [],
      overlayPosition: "top-right",
    });

    // 720 - 30 - 150 = 540
    expect(result).toMatch(/overlay=540:30/);
  });

  it("positions overlays in bottom-left when specified", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: [],
      overlayPosition: "bottom-left",
    });

    // 1280 - 30 - 150 = 1100
    expect(result).toMatch(/overlay=30:1100/);
  });

  it("positions overlays in bottom-right when specified", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: [],
      overlayPosition: "bottom-right",
    });

    expect(result).toMatch(/overlay=540:1100/);
  });

  it("defaults to top-left when no overlayPosition provided", () => {
    const result = buildFilterComplex({
      overlayCount: 1,
      captionFilters: [],
    });

    expect(result).toMatch(/overlay=30:30/);
  });
});

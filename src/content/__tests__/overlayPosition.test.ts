import { describe, it, expect } from "vitest";

import { calculateOverlayCoordinates } from "../overlayPosition";

describe("calculateOverlayCoordinates", () => {
  it("top-left: first overlay at (30, 30)", () => {
    expect(calculateOverlayCoordinates("top-left", 0)).toEqual({ x: 30, y: 30 });
  });

  it("top-left: second overlay stacks below", () => {
    expect(calculateOverlayCoordinates("top-left", 1)).toEqual({ x: 30, y: 300 });
  });

  it("top-right: first overlay at right edge", () => {
    // 720 - 30 - 250 = 440
    expect(calculateOverlayCoordinates("top-right", 0)).toEqual({ x: 440, y: 30 });
  });

  it("top-right: second overlay stacks below", () => {
    expect(calculateOverlayCoordinates("top-right", 1)).toEqual({ x: 440, y: 300 });
  });

  it("bottom-left: first overlay near bottom edge", () => {
    // 1280 - 30 - 250 = 1000
    expect(calculateOverlayCoordinates("bottom-left", 0)).toEqual({ x: 30, y: 1000 });
  });

  it("bottom-left: second overlay stacks upward", () => {
    // 1000 - 270 = 730
    expect(calculateOverlayCoordinates("bottom-left", 1)).toEqual({ x: 30, y: 730 });
  });

  it("bottom-right: first overlay at bottom-right corner", () => {
    expect(calculateOverlayCoordinates("bottom-right", 0)).toEqual({ x: 440, y: 1000 });
  });

  it("bottom-right: second overlay stacks upward", () => {
    expect(calculateOverlayCoordinates("bottom-right", 1)).toEqual({ x: 440, y: 730 });
  });

  it("respects custom overlay size for positioning", () => {
    // 720 - 30 - 150 = 540, 1280 - 30 - 150 = 1100
    expect(calculateOverlayCoordinates("bottom-right", 0, 150)).toEqual({ x: 540, y: 1100 });
  });

  it("stacks with custom overlay size", () => {
    // 1100 - (150 + 20) = 930
    expect(calculateOverlayCoordinates("bottom-right", 1, 150)).toEqual({ x: 540, y: 930 });
  });
});

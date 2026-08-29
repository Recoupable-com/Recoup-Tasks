import { describe, it, expect } from "vitest";
import { resolveDspLogoUrl } from "../resolveDspLogoUrl";

describe("resolveDspLogoUrl", () => {
  it("returns null for 'none'", () => {
    expect(resolveDspLogoUrl("none")).toBeNull();
  });

  it("returns a URL for 'spotify'", () => {
    const url = resolveDspLogoUrl("spotify");
    expect(url).toContain("spotify");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("returns a URL for 'apple'", () => {
    const url = resolveDspLogoUrl("apple");
    expect(url).toContain("apple");
    expect(url).toMatch(/^https?:\/\//);
  });
});

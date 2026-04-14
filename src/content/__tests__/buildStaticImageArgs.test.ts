import { describe, it, expect } from "vitest";

import { buildStaticImageArgs } from "../buildStaticImageArgs";

describe("buildStaticImageArgs", () => {
  it("builds ffmpeg args with image input and overlay images", () => {
    const args = buildStaticImageArgs({
      imagePath: "/tmp/base.png",
      overlayImagePaths: ["/tmp/ovr-0.png", "/tmp/ovr-1.png"],
      outputPath: "/tmp/output.png",
    });

    expect(args).toContain("-y");
    expect(args).toContain("/tmp/base.png");
    expect(args).toContain("/tmp/ovr-0.png");
    expect(args).toContain("/tmp/ovr-1.png");
    expect(args).toContain("/tmp/output.png");
  });

  it("includes filter_complex with crop, scale, and overlays", () => {
    const args = buildStaticImageArgs({
      imagePath: "/tmp/base.png",
      overlayImagePaths: ["/tmp/ovr-0.png"],
      outputPath: "/tmp/output.png",
    });

    const filterIdx = args.indexOf("-filter_complex");
    expect(filterIdx).toBeGreaterThan(-1);

    const filter = args[filterIdx + 1];
    expect(filter).toContain("crop=ih*9/16:ih");
    expect(filter).toContain("scale=720:1280");
    expect(filter).toContain("scale=150:150");
    expect(filter).toContain("overlay=30:30");
  });

  it("stacks multiple overlays vertically", () => {
    const args = buildStaticImageArgs({
      imagePath: "/tmp/base.png",
      overlayImagePaths: ["/tmp/a.png", "/tmp/b.png"],
      outputPath: "/tmp/output.png",
    });

    const filter = args[args.indexOf("-filter_complex") + 1];
    expect(filter).toContain("overlay=30:30");
    expect(filter).toContain("overlay=30:200");
  });

  it("handles no overlay images — just crops and scales", () => {
    const args = buildStaticImageArgs({
      imagePath: "/tmp/base.png",
      overlayImagePaths: [],
      outputPath: "/tmp/output.png",
    });

    expect(args).toContain("-vf");
    expect(args).not.toContain("-filter_complex");

    const vfIdx = args.indexOf("-vf");
    const vf = args[vfIdx + 1];
    expect(vf).toContain("crop=ih*9/16:ih");
    expect(vf).toContain("scale=720:1280");
  });

  it("maps [out] and outputs single frame", () => {
    const args = buildStaticImageArgs({
      imagePath: "/tmp/base.png",
      overlayImagePaths: ["/tmp/ovr.png"],
      outputPath: "/tmp/output.png",
    });

    expect(args).toContain("-map");
    expect(args).toContain("[out]");
    expect(args).toContain("-frames:v");
    expect(args).toContain("1");
  });
});

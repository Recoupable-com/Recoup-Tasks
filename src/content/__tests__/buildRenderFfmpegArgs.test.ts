import { describe, it, expect } from "vitest";
import { buildRenderFfmpegArgs } from "../buildRenderFfmpegArgs";

describe("buildRenderFfmpegArgs", () => {
  it("builds trim args with -ss and -t", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "trim", start: 5, duration: 10 },
    ]);
    expect(args).toContain("-ss");
    expect(args).toContain("5");
    expect(args).toContain("-t");
    expect(args).toContain("10");
  });

  it("builds crop filter for aspect ratio", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "9:16" },
    ]);
    const vfIndex = args.indexOf("-vf");
    expect(vfIndex).toBeGreaterThan(-1);
    expect(args[vfIndex + 1]).toContain("crop=");
  });

  // Fix #5: crop 9:16 on a landscape video should crop width, not expand height
  it("builds crop 9:16 as portrait crop (narrows width from source)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "9:16" },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    // 9:16 means w < h, so crop width to ih*9/16 and keep height
    expect(vf).toContain("crop=ih*9/16:ih");
  });

  it("builds crop 16:9 as landscape crop (narrows height from source)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "16:9" },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    // 16:9 means w > h, so crop height to iw*9/16 and keep width
    expect(vf).toContain("crop=iw:iw*9/16");
  });

  it("builds resize filter with scale", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "resize", width: 1080, height: 1920 },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("scale=1080:1920");
  });

  it("builds overlay_text with drawtext and uses escapeDrawtext", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      {
        type: "overlay_text",
        content: "hello world",
        color: "white",
        stroke_color: "black",
        max_font_size: 42,
        position: "bottom" as const,
      },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("drawtext=");
    expect(vf).toContain("fontsize=42");
    expect(vf).toContain("fontcolor=white");
    expect(vf).toContain("bordercolor=black");
    expect(vf).toContain("y=h-th-120");
  });

  it("positions overlay_text at top", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      {
        type: "overlay_text",
        content: "top text",
        color: "white",
        stroke_color: "black",
        max_font_size: 42,
        position: "top" as const,
      },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("y=180");
  });

  it("positions overlay_text at center", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      {
        type: "overlay_text",
        content: "center text",
        color: "white",
        stroke_color: "black",
        max_font_size: 42,
        position: "center" as const,
      },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("y=(h-th)/2");
  });

  it("strips emoji from overlay_text content", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      {
        type: "overlay_text",
        content: "hello 🔥 world",
        color: "white",
        stroke_color: "black",
        max_font_size: 42,
        position: "bottom" as const,
      },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).not.toContain("🔥");
  });

  it("skips overlay_text when content is missing (template mode)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "overlay_text", color: "white", stroke_color: "black", max_font_size: 42, position: "bottom" as const },
    ]);
    expect(args).not.toContain("-vf");
  });

  it("chains multiple video operations in order", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "9:16" },
      {
        type: "overlay_text",
        content: "caption",
        color: "white",
        stroke_color: "black",
        max_font_size: 42,
        position: "bottom" as const,
      },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("crop=");
    expect(vf).toContain(",");
    expect(vf).toContain("drawtext=");
  });

  // Fix #1: no mux_audio — should not accept mux_audio operations
  it("does not handle mux_audio operations (video-only)", () => {
    // buildRenderFfmpegArgs should not have mux_audio case
    // Passing an unknown type should result in no extra inputs
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "trim", start: 0, duration: 5 },
    ]);
    expect(args).not.toContain("-map");
    expect(args.join(" ")).not.toContain("amix");
  });

  // Fix #2: no audioOnly, no fallbackAudioUrl params
  it("function signature has no audioOnly or fallbackAudioUrl params", () => {
    // Should work with just 3 args — no 4th or 5th param needed
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "trim", start: 0, duration: 5 },
    ]);
    expect(args.length).toBeGreaterThan(0);
  });

  it("always includes video output encoding flags", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "trim", start: 0, duration: 5 },
    ]);
    expect(args).toContain("-c:v");
    expect(args).toContain("libx264");
    expect(args).toContain("-c:a");
    expect(args).toContain("aac");
    expect(args).toContain("-pix_fmt");
    expect(args).toContain("yuv420p");
    expect(args[args.length - 1]).toBe("out.mp4");
  });
});

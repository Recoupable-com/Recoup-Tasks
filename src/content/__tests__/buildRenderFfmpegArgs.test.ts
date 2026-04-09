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

  it("builds crop filter for portrait aspect (h > w)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "9:16" },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("iw:iw*16/9");
  });

  it("builds crop filter for landscape aspect (w > h)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "16:9" },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    expect(vf).toContain("ih*16/9:ih");
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
    // Emoji should be stripped, leaving "hello world"
    expect(vf).not.toContain("🔥");
  });

  it("builds mux_audio with replace=true", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "mux_audio", audio_url: "https://example.com/song.mp3", replace: true },
    ]);
    expect(args).toContain("https://example.com/song.mp3");
    expect(args).toContain("-map");
    const mapIndices = args.reduce((acc: number[], v, i) => (v === "-map" ? [...acc, i] : acc), []);
    expect(args[mapIndices[0] + 1]).toBe("0:v:0");
    expect(args[mapIndices[1] + 1]).toBe("1:a:0");
  });

  it("builds mux_audio with replace=false using amix filter", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "mux_audio", audio_url: "https://example.com/song.mp3", replace: false },
    ]);
    expect(args).toContain("-filter_complex");
    const fcIndex = args.indexOf("-filter_complex");
    expect(args[fcIndex + 1]).toContain("amix=inputs=2");
    expect(args[fcIndex + 1]).toContain("[aout]");
    expect(args).toContain("[aout]");
  });

  it("chains multiple operations in order", () => {
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
      { type: "mux_audio", audio_url: "https://example.com/song.mp3", replace: true },
    ]);
    const vf = args[args.indexOf("-vf") + 1];
    // Video filters should be chained with comma
    expect(vf).toContain("crop=");
    expect(vf).toContain(",");
    expect(vf).toContain("drawtext=");
    // Audio should be added as extra input
    expect(args).toContain("https://example.com/song.mp3");
  });

  it("skips overlay_text when content is missing (template mode)", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "overlay_text", color: "white", stroke_color: "black", max_font_size: 42, position: "bottom" as const },
    ]);
    const hasVf = args.includes("-vf");
    expect(hasVf).toBe(false);
  });

  it("skips mux_audio when audio_url is missing and no fallback", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "mux_audio", replace: true },
    ]);
    expect(args).not.toContain("-map");
  });

  it("uses fallback audio_url for mux_audio when op has no audio_url", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "mux_audio", replace: true },
    ], "https://example.com/fallback.mp3");
    expect(args).toContain("https://example.com/fallback.mp3");
    expect(args).toContain("-map");
  });

  it("places all -i inputs before -vf filters", () => {
    const args = buildRenderFfmpegArgs("in.mp4", "out.mp4", [
      { type: "crop", aspect: "9:16" },
      { type: "mux_audio", replace: true },
    ], "https://example.com/song.mp3");

    const vfIndex = args.indexOf("-vf");
    const lastInputIndex = args.lastIndexOf("-i");
    expect(vfIndex).toBeGreaterThan(-1);
    expect(lastInputIndex).toBeGreaterThan(-1);
    expect(lastInputIndex).toBeLessThan(vfIndex);
  });

  it("always includes output encoding flags", () => {
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

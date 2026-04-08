import { describe, it, expect } from "vitest";

import { buildFfmpegArgs } from "../buildFfmpegArgs";

describe("buildFfmpegArgs", () => {
  const baseCaptionLayout = {
    lines: ["hello world"],
    fontSize: 42,
    lineHeight: 52,
    position: "bottom" as const,
  };

  it("includes -map 0:a when hasAudio and hasOverlays", () => {
    const args = buildFfmpegArgs({
      videoPath: "/tmp/video.mp4",
      audioPath: "/tmp/audio.mp3",
      captionLayout: baseCaptionLayout,
      outputPath: "/tmp/out.mp4",
      audioStartSeconds: 0,
      audioDurationSeconds: 10,
      hasAudio: true,
      overlayImagePaths: ["/tmp/overlay-0.png"],
    });

    expect(args).toContain("-map");
    expect(args).toContain("[out]");
    expect(args).toContain("0:a");
  });

  it("uses -vf filter when no overlays", () => {
    const args = buildFfmpegArgs({
      videoPath: "/tmp/video.mp4",
      audioPath: "/tmp/audio.mp3",
      captionLayout: baseCaptionLayout,
      outputPath: "/tmp/out.mp4",
      audioStartSeconds: 0,
      audioDurationSeconds: 10,
      hasAudio: false,
      overlayImagePaths: [],
    });

    expect(args).toContain("-vf");
    expect(args).not.toContain("-filter_complex");
  });

  it("uses -filter_complex when overlays are present", () => {
    const args = buildFfmpegArgs({
      videoPath: "/tmp/video.mp4",
      audioPath: "/tmp/audio.mp3",
      captionLayout: baseCaptionLayout,
      outputPath: "/tmp/out.mp4",
      audioStartSeconds: 5,
      audioDurationSeconds: 15,
      hasAudio: false,
      overlayImagePaths: ["/tmp/overlay-0.png"],
    });

    expect(args).toContain("-filter_complex");
    expect(args).not.toContain("-vf");
  });
});

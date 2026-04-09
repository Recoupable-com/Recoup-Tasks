import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRenderPayloadSchema } from "../../schemas/ffmpegEditSchema";

// Mock fal.ai server config
vi.mock("../../content/falServer", () => ({
  default: {
    config: vi.fn(),
    storage: { upload: vi.fn() },
  },
}));

// Mock trigger.dev
vi.mock("@trigger.dev/sdk/v3", () => ({
  schemaTask: vi.fn((config) => config),
  tags: { add: vi.fn() },
}));

// Mock logStep
vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

describe("createRenderPayloadSchema", () => {
  it("validates a payload with video_url and trim operation", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "trim", start: 0, duration: 5 }],
    });
    expect(result.success).toBe(true);
  });

  it("validates a payload with audio_url and mux_audio operation", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      audio_url: "https://example.com/audio.mp3",
      operations: [
        { type: "mux_audio", audio_url: "https://example.com/track.mp3" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("validates a payload with crop operation", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "crop", aspect: "9:16" }],
    });
    expect(result.success).toBe(true);
  });

  it("validates a payload with overlay_text operation and defaults", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "overlay_text", content: "hello world" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const op = result.data.operations[0];
      if (op.type === "overlay_text") {
        expect(op.color).toBe("white");
        expect(op.stroke_color).toBe("black");
        expect(op.max_font_size).toBe(42);
        expect(op.position).toBe("bottom");
      }
    }
  });

  it("validates a payload with multiple operations in order", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [
        { type: "crop", aspect: "9:16" },
        { type: "overlay_text", content: "caption text" },
        {
          type: "mux_audio",
          audio_url: "https://example.com/song.mp3",
          replace: true,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.operations).toHaveLength(3);
    }
  });

  it("defaults output_format to mp4", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "trim", start: 0, duration: 5 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.output_format).toBe("mp4");
    }
  });

  it("rejects missing accountId", () => {
    const result = createRenderPayloadSchema.safeParse({
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "trim", start: 0, duration: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty operations array", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects crop with no dimensions or aspect", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "crop" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects resize with no dimensions", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "resize" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects color values with special characters", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "overlay_text", content: "test", color: "white:enable=0" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid operation type", () => {
    const result = createRenderPayloadSchema.safeParse({
      accountId: "acc-123",
      video_url: "https://example.com/video.mp4",
      operations: [{ type: "invalid_op" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("ffmpegEditTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-key";
  });

  it("exports a task with id ffmpeg-edit", async () => {
    const { ffmpegEditTask } = await import("../ffmpegEditTask");
    expect(ffmpegEditTask.id).toBe("ffmpeg-edit");
  });

  it("uses the createRenderPayloadSchema", async () => {
    const { ffmpegEditTask } = await import("../ffmpegEditTask");
    expect(ffmpegEditTask.schema).toBe(createRenderPayloadSchema);
  });

  it("has medium-1x machine and 10 min max duration", async () => {
    const { ffmpegEditTask } = await import("../ffmpegEditTask");
    expect(ffmpegEditTask.machine).toBe("medium-1x");
    expect(ffmpegEditTask.maxDuration).toBe(600);
  });
});

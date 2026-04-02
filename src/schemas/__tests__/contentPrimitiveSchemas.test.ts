import { describe, expect, it } from "vitest";
import {
  createImagePayloadSchema,
  createVideoPayloadSchema,
  createAudioPayloadSchema,
  createRenderPayloadSchema,
  createUpscalePayloadSchema,
  textStyleSchema,
} from "../contentPrimitiveSchemas";

describe("createImagePayloadSchema", () => {
  const base = {
    accountId: "acc_123",
    template: "artist-caption-bedroom",
    artistSlug: "gatsby-grace",
    githubRepo: "https://github.com/recoupable/test-repo",
  };

  it("parses a valid payload", () => {
    expect(createImagePayloadSchema.safeParse(base).success).toBe(true);
  });

  it("accepts optional prompt and faceGuideUrl", () => {
    const result = createImagePayloadSchema.safeParse({
      ...base,
      prompt: "moody bedroom selfie",
      faceGuideUrl: "https://example.com/face.png",
    });
    expect(result.success).toBe(true);
  });

  it("fails when template is missing", () => {
    const { template: _, ...noTemplate } = base;
    expect(createImagePayloadSchema.safeParse(noTemplate).success).toBe(false);
  });

  it("fails when githubRepo is not a URL", () => {
    expect(createImagePayloadSchema.safeParse({ ...base, githubRepo: "not-a-url" }).success).toBe(false);
  });
});

describe("createVideoPayloadSchema", () => {
  const base = {
    accountId: "acc_123",
    imageUrl: "https://example.com/image.png",
  };

  it("parses a valid payload", () => {
    expect(createVideoPayloadSchema.safeParse(base).success).toBe(true);
  });

  it("defaults lipsync to false", () => {
    const result = createVideoPayloadSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lipsync).toBe(false);
  });

  it("accepts lipsync with song URL", () => {
    const result = createVideoPayloadSchema.safeParse({
      ...base,
      lipsync: true,
      songUrl: "https://example.com/song.mp3",
      audioStartSeconds: 10,
      audioDurationSeconds: 15,
    });
    expect(result.success).toBe(true);
  });

  it("fails when imageUrl is missing", () => {
    expect(createVideoPayloadSchema.safeParse({ accountId: "acc_123" }).success).toBe(false);
  });
});

describe("createAudioPayloadSchema", () => {
  const base = {
    accountId: "acc_123",
    githubRepo: "https://github.com/recoupable/test-repo",
    artistSlug: "gatsby-grace",
  };

  it("parses a valid payload", () => {
    expect(createAudioPayloadSchema.safeParse(base).success).toBe(true);
  });

  it("accepts songs filter", () => {
    const result = createAudioPayloadSchema.safeParse({ ...base, songs: ["hiccups", "https://example.com/track.mp3"] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.songs).toEqual(["hiccups", "https://example.com/track.mp3"]);
  });

  it("fails when artistSlug is missing", () => {
    const { artistSlug: _, ...noSlug } = base;
    expect(createAudioPayloadSchema.safeParse(noSlug).success).toBe(false);
  });
});

describe("textStyleSchema", () => {
  it("parses content only", () => {
    expect(textStyleSchema.safeParse({ content: "hello world" }).success).toBe(true);
  });

  it("parses with all style fields", () => {
    const result = textStyleSchema.safeParse({
      content: "test caption",
      font: "TikTokSans.ttf",
      color: "white",
      borderColor: "black",
      maxFontSize: 42,
    });
    expect(result.success).toBe(true);
  });

  it("fails when content is empty", () => {
    expect(textStyleSchema.safeParse({ content: "" }).success).toBe(false);
  });
});

describe("createRenderPayloadSchema", () => {
  const base = {
    accountId: "acc_123",
    videoUrl: "https://example.com/video.mp4",
    songUrl: "https://example.com/song.mp3",
    audioStartSeconds: 10,
    audioDurationSeconds: 15,
    text: { content: "he was just taking notes" },
  };

  it("parses a valid payload", () => {
    expect(createRenderPayloadSchema.safeParse(base).success).toBe(true);
  });

  it("defaults hasAudio to false", () => {
    const result = createRenderPayloadSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hasAudio).toBe(false);
  });

  it("fails when text.content is missing", () => {
    expect(createRenderPayloadSchema.safeParse({ ...base, text: {} }).success).toBe(false);
  });

  it("fails when videoUrl is not a URL", () => {
    expect(createRenderPayloadSchema.safeParse({ ...base, videoUrl: "bad" }).success).toBe(false);
  });
});

describe("createUpscalePayloadSchema", () => {
  it("parses image upscale", () => {
    const result = createUpscalePayloadSchema.safeParse({
      accountId: "acc_123",
      url: "https://example.com/image.png",
      type: "image",
    });
    expect(result.success).toBe(true);
  });

  it("parses video upscale", () => {
    const result = createUpscalePayloadSchema.safeParse({
      accountId: "acc_123",
      url: "https://example.com/video.mp4",
      type: "video",
    });
    expect(result.success).toBe(true);
  });

  it("fails on invalid type", () => {
    expect(createUpscalePayloadSchema.safeParse({
      accountId: "acc_123",
      url: "https://example.com/file",
      type: "audio",
    }).success).toBe(false);
  });
});

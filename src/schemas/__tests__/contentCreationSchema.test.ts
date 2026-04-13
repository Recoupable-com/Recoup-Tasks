import { describe, expect, it } from "vitest";
import { createContentPayloadSchema } from "../contentCreationSchema";

describe("createContentPayloadSchema", () => {
  it("parses a valid payload", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: true,
      githubRepo: "https://github.com/recoupable/test-repo",
    });

    expect(result.success).toBe(true);
  });

  it("defaults lipsync to false", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lipsync).toBe(false);
    }
  });

  it("fails when artistSlug is missing", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      template: "artist-caption-bedroom",
      lipsync: false,
      githubRepo: "https://github.com/recoupable/test-repo",
    });

    expect(result.success).toBe(false);
  });

  it("accepts songs with a mix of slugs and URLs", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      songs: ["hiccups", "https://example.com/unreleased-track.mp3"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.songs).toEqual(["hiccups", "https://example.com/unreleased-track.mp3"]);
    }
  });

  it("accepts images as an array of URLs", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      images: ["https://example.com/face.png"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.images).toEqual(["https://example.com/face.png"]);
    }
  });

  it("rejects images with non-URL strings", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      images: ["not-a-url"],
    });

    expect(result.success).toBe(false);
  });

  it("accepts captionLength of 'none'", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      captionLength: "none",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.captionLength).toBe("none");
    }
  });

  it("defaults captionLength to 'none' when omitted", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.captionLength).toBe("none");
    }
  });

  it("does not accept attachedAudioUrl (removed)", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      attachedAudioUrl: "https://example.com/song.mp3",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("attachedAudioUrl");
    }
  });

  it("does not accept attachedImageUrl (removed)", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      attachedImageUrl: "https://example.com/face.png",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("attachedImageUrl");
    }
  });
});


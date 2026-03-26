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

  it("accepts an optional songs array", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
      songs: ["adhd", "hiccups"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.songs).toEqual(["adhd", "hiccups"]);
    }
  });

  it("defaults songs to undefined when omitted", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      githubRepo: "https://github.com/recoupable/test-repo",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.songs).toBeUndefined();
    }
  });
});


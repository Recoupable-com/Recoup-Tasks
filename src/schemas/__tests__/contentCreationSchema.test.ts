import { describe, expect, it } from "vitest";
import { createContentPayloadSchema } from "../contentCreationSchema";

describe("createContentPayloadSchema", () => {
  it("parses a valid payload", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
      lipsync: true,
    });

    expect(result.success).toBe(true);
  });

  it("defaults lipsync to false", () => {
    const result = createContentPayloadSchema.safeParse({
      accountId: "acc_123",
      artistSlug: "gatsby-grace",
      template: "artist-caption-bedroom",
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
    });

    expect(result.success).toBe(false);
  });
});


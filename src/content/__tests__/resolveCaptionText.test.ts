import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../recoup/contentApi", () => ({
  generateCaption: vi.fn(),
}));

import { resolveCaptionText } from "../resolveCaptionText";
import { generateCaption } from "../../recoup/contentApi";

describe("resolveCaptionText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty string and skips generateCaption when captionLength is 'none'", async () => {
    const result = await resolveCaptionText({
      captionLength: "none",
      topic: "Song: hiccups",
      template: "artist-caption-bedroom",
    });

    expect(result).toBe("");
    expect(generateCaption).not.toHaveBeenCalled();
  });

  it("calls generateCaption with the given length and returns its result", async () => {
    vi.mocked(generateCaption).mockResolvedValue("hiccups baby");

    const result = await resolveCaptionText({
      captionLength: "short",
      topic: "Song: hiccups",
      template: "artist-caption-bedroom",
    });

    expect(generateCaption).toHaveBeenCalledWith({
      topic: "Song: hiccups",
      template: "artist-caption-bedroom",
      length: "short",
    });
    expect(result).toBe("hiccups baby");
  });
});

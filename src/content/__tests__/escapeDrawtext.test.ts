import { describe, it, expect } from "vitest";

import { escapeDrawtext } from "../escapeDrawtext";

describe("escapeDrawtext", () => {
  it("replaces straight apostrophes with escaped quote safe for drawtext", () => {
    const result = escapeDrawtext("didn't");

    expect(result).not.toContain("'");
    // Must NOT use U+02BC (modifier letter apostrophe) — most fonts lack this glyph
    expect(result).not.toContain("\u02BC");
    expect(result).toContain("didn");
  });

  it("preserves curly right single quotation marks as-is", () => {
    const result = escapeDrawtext("didn\u2019t");

    // U+2019 is the replacement char — it should remain
    expect(result).toContain("\u2019");
    expect(result).not.toContain("\u02BC");
  });

  it("replaces curly left single quotation marks with right single quotation mark", () => {
    const result = escapeDrawtext("\u2018hello\u2019");

    expect(result).not.toContain("\u2018");
    expect(result).not.toContain("\u02BC");
    // Both should become U+2019
    expect(result).toBe("\u2019hello\u2019");
  });

  it("escapes colons for ffmpeg", () => {
    const result = escapeDrawtext("caption: hello");

    expect(result).toContain("\\\\:");
  });

  it("escapes percent to %% for a single literal % in ffmpeg drawtext", () => {
    const result = escapeDrawtext("100%");

    // ffmpeg drawtext: %% renders as single %. So "100%" should become "100%%".
    expect(result).toBe("100%%");
  });

  it("escapes backslashes", () => {
    const result = escapeDrawtext("back\\slash");

    expect(result).toContain("\\\\\\\\");
  });

  it("strips newlines and carriage returns", () => {
    expect(escapeDrawtext("line1\nline2")).toBe("line1 line2");
    expect(escapeDrawtext("line1\r\nline2")).toBe("line1 line2");
    expect(escapeDrawtext("line1\rline2")).toBe("line1line2");
  });

  it("handles a real caption with apostrophes and special chars", () => {
    const result = escapeDrawtext("didn't think anyone would hear this: it's real");

    // Should not contain raw single quotes, left curly quotes, or U+02BC
    expect(result).not.toMatch(/['\u2018\u2032\u02BC]/);
    // Should contain escaped colon
    expect(result).toContain("\\\\:");
  });
});

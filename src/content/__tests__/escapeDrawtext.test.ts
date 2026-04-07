import { describe, it, expect } from "vitest";

import { escapeDrawtext } from "../escapeDrawtext";

describe("escapeDrawtext", () => {
  it("replaces straight apostrophes", () => {
    const result = escapeDrawtext("didn't");

    expect(result).not.toContain("'");
    expect(result).toContain("didn");
  });

  it("replaces curly right single quotation marks", () => {
    const result = escapeDrawtext("didn\u2019t");

    expect(result).not.toContain("\u2019");
  });

  it("replaces curly left single quotation marks", () => {
    const result = escapeDrawtext("\u2018hello\u2019");

    expect(result).not.toContain("\u2018");
    expect(result).not.toContain("\u2019");
  });

  it("escapes colons for ffmpeg", () => {
    const result = escapeDrawtext("caption: hello");

    expect(result).toContain("\\\\:");
  });

  it("escapes percent signs", () => {
    const result = escapeDrawtext("100%");

    expect(result).toContain("%%%%");
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

    // Should not contain any raw single quotes
    expect(result).not.toMatch(/['\u2018\u2019\u2032]/);
    // Should contain escaped colon
    expect(result).toContain("\\\\:");
  });
});

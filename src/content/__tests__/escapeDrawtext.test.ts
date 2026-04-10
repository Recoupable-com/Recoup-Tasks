import { describe, it, expect } from "vitest";

import { escapeDrawtext } from "../escapeDrawtext";

describe("escapeDrawtext", () => {
  it("removes straight apostrophes", () => {
    const result = escapeDrawtext("didn't");
    expect(result).not.toContain("'");
    expect(result).toBe("didnt");
  });

  it("removes curly right single quotation marks", () => {
    const result = escapeDrawtext("didn\u2019t");
    expect(result).not.toContain("\u2019");
    expect(result).toBe("didnt");
  });

  it("removes curly left single quotation marks", () => {
    const result = escapeDrawtext("\u2018hello\u2019");
    expect(result).not.toContain("\u2018");
    expect(result).not.toContain("\u2019");
    expect(result).toBe("hello");
  });

  it("escapes colons for ffmpeg", () => {
    const result = escapeDrawtext("caption: hello");
    expect(result).toContain("\\\\:");
  });

  it("escapes percent to %% for ffmpeg drawtext", () => {
    const result = escapeDrawtext("100%");
    expect(result).toBe("100%%");
  });

  it("escapes backslashes", () => {
    const result = escapeDrawtext("back\\slash");
    expect(result).toContain("\\\\\\\\");
  });

  it("strips newlines and carriage returns", () => {
    expect(escapeDrawtext("line1\nline2")).toBe("line1 line2");
    expect(escapeDrawtext("line1\r\nline2")).toBe("line1 line2");
  });

  it("produces text safe inside ffmpeg single-quoted drawtext in filter_complex", () => {
    const result = escapeDrawtext("you're my addiction");
    expect(result).not.toContain("'");
    expect(result).not.toContain("\u2019");
    expect(result).toBe("youre my addiction");
  });

  it("handles a real caption with apostrophes and special chars", () => {
    const result = escapeDrawtext("didn't think anyone would hear this: it's real");
    expect(result).not.toMatch(/['\u2018\u2019\u2032]/);
    expect(result).toContain("\\\\:");
  });
});

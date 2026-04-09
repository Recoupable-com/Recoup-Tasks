import { describe, it, expect, vi } from "vitest";

vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd, _args, options, cb) => {
    // Capture the options passed to execFile
    if (typeof options === "function") {
      cb = options;
      options = {};
    }
    // Store options for assertion
    (globalThis as Record<string, unknown>).__lastExecFileOptions = options;
    cb(null, "", "");
    return {};
  }),
}));

describe("runFfmpeg", () => {
  it("sets maxBuffer to at least 10MB to handle ffmpeg stderr", async () => {
    const { runFfmpeg } = await import("../runFfmpeg");
    await runFfmpeg(["-version"]);

    const options = (globalThis as Record<string, unknown>).__lastExecFileOptions as { maxBuffer?: number };
    expect(options?.maxBuffer).toBeGreaterThanOrEqual(10 * 1024 * 1024);
  });
});

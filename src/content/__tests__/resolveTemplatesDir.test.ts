import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { resolveTemplatesDir } from "../resolveTemplatesDir";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { access: vi.fn() },
}));

const fs = (await import("node:fs/promises")).default;

describe("resolveTemplatesDir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns __dirname-relative path when it exists", async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);

    const result = await resolveTemplatesDir("/app/src/content");

    expect(result).toBe(path.resolve("/app/src/content", "../content/templates"));
    expect(fs.access).toHaveBeenCalledTimes(1);
  });

  it("falls back to cwd-relative path when __dirname path missing", async () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    vi.mocked(fs.access).mockRejectedValueOnce(err);
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);

    const result = await resolveTemplatesDir("/wrong/path");

    expect(result).toBe(path.resolve(process.cwd(), "src/content/templates"));
    expect(fs.access).toHaveBeenCalledTimes(2);
  });

  it("rethrows permission errors instead of falling through", async () => {
    const err = new Error("EACCES") as NodeJS.ErrnoException;
    err.code = "EACCES";
    vi.mocked(fs.access).mockRejectedValueOnce(err);

    await expect(resolveTemplatesDir("/app/src/content")).rejects.toThrow("EACCES");
    expect(fs.access).toHaveBeenCalledTimes(1);
  });

  it("throws when no candidate directory exists", async () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    vi.mocked(fs.access).mockRejectedValue(err);

    await expect(resolveTemplatesDir("/wrong/path")).rejects.toThrow(
      "Templates directory not found",
    );
  });
});

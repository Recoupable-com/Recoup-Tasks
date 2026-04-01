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
    vi.mocked(fs.access).mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);

    const result = await resolveTemplatesDir("/wrong/path");

    expect(result).toBe(path.resolve(process.cwd(), "src/content/templates"));
    expect(fs.access).toHaveBeenCalledTimes(2);
  });

  it("throws when no candidate directory exists", async () => {
    vi.mocked(fs.access).mockRejectedValue(new Error("ENOENT"));

    await expect(resolveTemplatesDir("/wrong/path")).rejects.toThrow(
      "Templates directory not found",
    );
  });
});

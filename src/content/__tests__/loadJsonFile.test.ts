import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadJsonFile } from "../loadJsonFile";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readFile: vi.fn() },
}));

const fs = (await import("node:fs/promises")).default;
const { logStep } = await import("../../sandboxes/logStep");

describe("loadJsonFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{"key": "value"}');

    const result = await loadJsonFile<Record<string, string>>("/path/to/file.json", "file.json");

    expect(result).toEqual({ key: "value" });
    expect(logStep).toHaveBeenCalledWith(
      "loadTemplate: loaded file.json",
      false,
      expect.objectContaining({ sizeBytes: 16 }),
    );
  });

  it("returns null when file does not exist", async () => {
    const err = new Error("ENOENT") as NodeJS.ErrnoException;
    err.code = "ENOENT";
    vi.mocked(fs.readFile).mockRejectedValue(err);

    const result = await loadJsonFile("/path/to/missing.json", "missing.json");

    expect(result).toBeNull();
  });

  it("rethrows non-ENOENT errors", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("EPERM"));

    await expect(loadJsonFile("/path/to/bad.json", "bad.json")).rejects.toThrow("EPERM");
  });
});

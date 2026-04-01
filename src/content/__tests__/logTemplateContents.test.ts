import { describe, it, expect, vi, beforeEach } from "vitest";
import { logTemplateContents } from "../logTemplateContents";

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { readdir: vi.fn() },
}));

const fs = (await import("node:fs/promises")).default;
const { logStep } = await import("../../sandboxes/logStep");

describe("logTemplateContents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs directory contents with file count", async () => {
    vi.mocked(fs.readdir).mockResolvedValue(["style-guide.json", "caption-guide.json"] as never);

    await logTemplateContents("/templates/bedroom");

    expect(logStep).toHaveBeenCalledWith(
      "loadTemplate: directory contents",
      false,
      expect.objectContaining({ totalFiles: 2 }),
    );
  });

  it("logs error when directory read fails", async () => {
    vi.mocked(fs.readdir).mockRejectedValue(new Error("ENOENT"));

    await logTemplateContents("/templates/missing");

    expect(logStep).toHaveBeenCalledWith(
      "loadTemplate: failed to list directory",
      true,
      expect.objectContaining({ error: expect.stringContaining("ENOENT") }),
    );
  });
});

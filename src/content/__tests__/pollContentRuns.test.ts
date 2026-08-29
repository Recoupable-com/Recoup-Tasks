import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    poll: vi.fn(),
  },
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

import { runs } from "@trigger.dev/sdk/v3";
import { pollContentRuns } from "../pollContentRuns";

const mockPoll = vi.mocked(runs.poll);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pollContentRuns", () => {
  it("returns completed results when all runs finish", async () => {
    mockPoll.mockResolvedValue({
      status: "COMPLETED",
      output: { videoSourceUrl: "https://v.mp4", captionText: "caption", staticImageUrl: "https://img.png" },
    } as any);

    const results = await pollContentRuns(["run-1", "run-2"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: "https://v.mp4", captionText: "caption", imageUrl: "https://img.png" },
      { runId: "run-2", status: "completed", videoUrl: "https://v.mp4", captionText: "caption", imageUrl: "https://img.png" },
    ]);
    expect(mockPoll).toHaveBeenCalledTimes(2);
    expect(mockPoll).toHaveBeenCalledWith("run-1", { pollIntervalMs: 30_000 });
    expect(mockPoll).toHaveBeenCalledWith("run-2", { pollIntervalMs: 30_000 });
  });

  it("returns failed result for FAILED run status", async () => {
    mockPoll.mockResolvedValue({ status: "FAILED" } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Run failed" },
    ]);
  });

  it("returns failed result for CANCELED run status", async () => {
    mockPoll.mockResolvedValue({ status: "CANCELED" } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Run canceled" },
    ]);
  });

  it("returns failed result when runs.poll throws", async () => {
    mockPoll.mockRejectedValue(new Error("Poll timeout"));

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Poll timeout" },
    ]);
  });

  it("handles null output gracefully", async () => {
    mockPoll.mockResolvedValue({
      status: "COMPLETED",
      output: null,
    } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: undefined, captionText: undefined, imageUrl: undefined },
    ]);
  });

  it("polls all runs concurrently", async () => {
    let resolveOrder: string[] = [];
    mockPoll.mockImplementation(async (runId: any) => {
      resolveOrder.push(runId);
      return { status: "COMPLETED", output: null } as any;
    });

    await pollContentRuns(["run-1", "run-2", "run-3"]);

    expect(resolveOrder).toEqual(["run-1", "run-2", "run-3"]);
    expect(mockPoll).toHaveBeenCalledTimes(3);
  });

  it("handles mixed results — some completed, some failed", async () => {
    mockPoll
      .mockResolvedValueOnce({
        status: "COMPLETED",
        output: { videoSourceUrl: "https://v.mp4" },
      } as any)
      .mockResolvedValueOnce({ status: "FAILED" } as any)
      .mockRejectedValueOnce(new Error("Network error"));

    const results = await pollContentRuns(["run-1", "run-2", "run-3"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: "https://v.mp4", captionText: undefined, imageUrl: undefined },
      { runId: "run-2", status: "failed", error: "Run failed" },
      { runId: "run-3", status: "failed", error: "Network error" },
    ]);
  });
});

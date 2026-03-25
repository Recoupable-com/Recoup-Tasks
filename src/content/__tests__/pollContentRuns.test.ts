import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@trigger.dev/sdk/v3", () => ({
  runs: {
    retrieve: vi.fn(),
  },
  wait: {
    for: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../sandboxes/logStep", () => ({
  logStep: vi.fn(),
}));

import { runs, wait } from "@trigger.dev/sdk/v3";
import { pollContentRuns } from "../pollContentRuns";

const mockRetrieve = vi.mocked(runs.retrieve);
const mockWaitFor = vi.mocked(wait.for);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pollContentRuns", () => {
  it("returns completed results when all runs finish on first poll", async () => {
    mockRetrieve.mockResolvedValue({
      status: "COMPLETED",
      output: { videoSourceUrl: "https://v.mp4", captionText: "caption" },
    } as any);

    const results = await pollContentRuns(["run-1", "run-2"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: "https://v.mp4", captionText: "caption" },
      { runId: "run-2", status: "completed", videoUrl: "https://v.mp4", captionText: "caption" },
    ]);
    expect(mockWaitFor).not.toHaveBeenCalled();
  });

  it("returns failed result for FAILED run status", async () => {
    mockRetrieve.mockResolvedValue({ status: "FAILED" } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Run failed" },
    ]);
  });

  it("returns failed result for CANCELED run status", async () => {
    mockRetrieve.mockResolvedValue({ status: "CANCELED" } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Run canceled" },
    ]);
  });

  it("polls again when run is still in progress", async () => {
    let callCount = 0;
    mockRetrieve.mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) {
        return { status: "EXECUTING" } as any;
      }
      return {
        status: "COMPLETED",
        output: { videoSourceUrl: "https://v.mp4" },
      } as any;
    });

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: "https://v.mp4", captionText: undefined },
    ]);
    expect(mockWaitFor).toHaveBeenCalledTimes(1);
  });

  it("marks run as failed after 3 consecutive retrieval errors", async () => {
    mockRetrieve.mockRejectedValue(new Error("Network error"));

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "failed", error: "Retrieval failed 3 consecutive times" },
    ]);
  });

  it("resets retrieval failure count on successful retrieve", async () => {
    let callCount = 0;
    mockRetrieve.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("Network error");
      if (callCount === 2) return { status: "EXECUTING" } as any;
      if (callCount === 3) throw new Error("Network error");
      if (callCount === 4) return { status: "EXECUTING" } as any;
      return { status: "COMPLETED", output: null } as any;
    });

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: undefined, captionText: undefined },
    ]);
  });

  it("handles null output gracefully", async () => {
    mockRetrieve.mockResolvedValue({
      status: "COMPLETED",
      output: null,
    } as any);

    const results = await pollContentRuns(["run-1"]);

    expect(results).toEqual([
      { runId: "run-1", status: "completed", videoUrl: undefined, captionText: undefined },
    ]);
  });
});

import { describe, it, expect } from "vitest";
import { resolveOverallStatus } from "../resolveOverallStatus";
import type { ContentRunResult } from "../pollContentRuns";

describe("resolveOverallStatus", () => {
  it("returns 'completed' when all runs completed", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "completed", videoUrl: "https://example.com/v.mp4" },
      { runId: "run-2", status: "completed", captionText: "Hello" },
    ];
    expect(resolveOverallStatus(results)).toBe("completed");
  });

  it("returns 'failed' when any run failed and none timed out", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "completed" },
      { runId: "run-2", status: "failed", error: "Run crashed" },
    ];
    expect(resolveOverallStatus(results)).toBe("failed");
  });

  it("returns 'timeout' when any run timed out", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "completed" },
      { runId: "run-2", status: "timeout" },
    ];
    expect(resolveOverallStatus(results)).toBe("timeout");
  });

  it("returns 'timeout' over 'failed' when both present", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "failed", error: "Run crashed" },
      { runId: "run-2", status: "timeout" },
    ];
    expect(resolveOverallStatus(results)).toBe("timeout");
  });

  it("returns 'completed' for a single completed run", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "completed" },
    ];
    expect(resolveOverallStatus(results)).toBe("completed");
  });

  it("returns 'failed' when all runs failed", () => {
    const results: ContentRunResult[] = [
      { runId: "run-1", status: "failed", error: "Run crashed" },
      { runId: "run-2", status: "failed", error: "Run canceled" },
    ];
    expect(resolveOverallStatus(results)).toBe("failed");
  });
});

import type { ContentRunResult } from "./pollContentRuns";

/**
 * Determines overall status from individual run results.
 */
export function resolveOverallStatus(
  results: ContentRunResult[],
): "completed" | "failed" | "timeout" {
  const allCompleted = results.every(r => r.status === "completed");
  const anyTimeout = results.some(r => r.status === "timeout");

  if (anyTimeout) return "timeout";
  if (allCompleted) return "completed";
  return "failed";
}

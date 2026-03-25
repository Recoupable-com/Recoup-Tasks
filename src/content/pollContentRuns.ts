import { runs, wait } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";

const POLL_INTERVAL_SECONDS = 30;
const RETRIEVAL_FAILURE_THRESHOLD = 3;

export type ContentRunResult = {
  runId: string;
  status: "completed" | "failed" | "timeout";
  videoUrl?: string;
  captionText?: string;
  error?: string;
};

/**
 * Polls Trigger.dev create-content runs until all are finished.
 * Bounded by the task's maxDuration rather than an internal attempt limit.
 */
export async function pollContentRuns(
  runIds: string[],
): Promise<ContentRunResult[]> {
  const pendingRunIds = new Set(runIds);
  const results: ContentRunResult[] = [];
  const retrievalFailures = new Map<string, number>();

  while (pendingRunIds.size > 0) {

    for (const runId of Array.from(pendingRunIds)) {
      try {
        const run = await runs.retrieve(runId);
        retrievalFailures.set(runId, 0);

        if (run.status === "COMPLETED") {
          const output = run.output as {
            videoSourceUrl?: string;
            captionText?: string;
          } | null;

          results.push({
            runId,
            status: "completed",
            videoUrl: output?.videoSourceUrl,
            captionText: output?.captionText,
          });
          pendingRunIds.delete(runId);
          logStep(`Run completed: ${runId}`, false, { runId });
        } else if (
          run.status === "FAILED" ||
          run.status === "CANCELED" ||
          run.status === "CRASHED" ||
          run.status === "SYSTEM_FAILURE" ||
          run.status === "EXPIRED" ||
          run.status === "TIMED_OUT"
        ) {
          results.push({
            runId,
            status: "failed",
            error: `Run ${run.status.toLowerCase()}`,
          });
          pendingRunIds.delete(runId);
          logStep(`Run failed: ${runId} (${run.status})`, false, {
            runId,
            status: run.status,
          });
        }
      } catch (error) {
        const failures = (retrievalFailures.get(runId) ?? 0) + 1;
        retrievalFailures.set(runId, failures);
        logStep(`Error retrieving run ${runId} (attempt ${failures})`, false, {
          runId,
          error,
        });

        if (failures >= RETRIEVAL_FAILURE_THRESHOLD) {
          results.push({
            runId,
            status: "failed",
            error: `Retrieval failed ${failures} consecutive times`,
          });
          pendingRunIds.delete(runId);
        }
      }
    }

    if (pendingRunIds.size > 0) {
      await wait.for({ seconds: POLL_INTERVAL_SECONDS });
    }
  }

  return results;
}

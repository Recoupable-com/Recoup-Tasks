import { runs } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";

const POLL_INTERVAL_MS = 30_000;

export type ContentRunResult = {
  runId: string;
  status: "completed" | "failed" | "timeout";
  videoUrl?: string;
  captionText?: string;
  error?: string;
};

/**
 * Waits for all Trigger.dev create-content runs to reach a terminal state
 * using the native runs.poll() function, then maps results.
 */
export async function pollContentRuns(
  runIds: string[],
): Promise<ContentRunResult[]> {
  const settled = await Promise.allSettled(
    runIds.map(runId =>
      runs.poll(runId, { pollIntervalMs: POLL_INTERVAL_MS }),
    ),
  );

  return settled.map((result, i) => {
    const runId = runIds[i];

    if (result.status === "rejected") {
      logStep(`Run poll failed: ${runId}`, false, { runId, error: result.reason });
      return {
        runId,
        status: "failed" as const,
        error: result.reason?.message ?? "Unknown error",
      };
    }

    const run = result.value;

    if (run.status === "COMPLETED") {
      const output = run.output as {
        videoSourceUrl?: string;
        captionText?: string;
        /** ffmpeg-edit tasks return `url` instead of `videoSourceUrl`. */
        url?: string;
      } | null;

      logStep(`Run completed: ${runId}`, false, { runId });
      return {
        runId,
        status: "completed" as const,
        videoUrl: output?.videoSourceUrl ?? output?.url,
        captionText: output?.captionText,
      };
    }

    logStep(`Run failed: ${runId} (${run.status})`, false, { runId, status: run.status });
    return {
      runId,
      status: "failed" as const,
      error: `Run ${run.status.toLowerCase()}`,
    };
  });
}

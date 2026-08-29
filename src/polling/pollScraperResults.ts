import { wait } from "@trigger.dev/sdk/v3";
import { getScraperResults } from "../recoup/getScraperResults";
import { logStep } from "../utils/logStep";

// Base type with shared fields
type ScrapeRun = {
  runId: string;
  datasetId: string;
};

export type PollResult = ScrapeRun & {
  status: string;
  data?: unknown[];
};

const MAX_POLL_RETRIES = 30;

/**
 * Polls each scraper run in parallel until all are completed (SUCCEEDED or FAILED).
 * Returns an array of results for each run.
 */
export async function pollScraperResults(
  runs: ScrapeRun[]
): Promise<PollResult[]> {
  const results: PollResult[] = [];
  const pendingRuns = new Map<string, ScrapeRun>(
    runs.map((run) => [run.runId, run])
  );
  const retryCounts = new Map<string, number>();

  while (pendingRuns.size > 0) {
    // Poll all pending runs in parallel
    const pollPromises = Array.from(pendingRuns.values()).map(async (run) => {
      const result = await getScraperResults(run.runId);

      if (!result) {
        const retries = (retryCounts.get(run.runId) ?? 0) + 1;
        retryCounts.set(run.runId, retries);

        if (retries >= MAX_POLL_RETRIES) {
          logStep("poll-scraper", "Max retries reached, marking as FAILED", { runId: run.runId, retries }, "error");
          return {
            run,
            pollResult: {
              runId: run.runId,
              datasetId: run.datasetId,
              status: "FAILED",
            },
          };
        }

        logStep("poll-scraper", "Failed to get scraper result", { runId: run.runId, retry: retries }, "warn");
        return null;
      }

      if (result.status === "SUCCEEDED") {
        const completedResult = result as {
          status: string;
          dataset_id: string | null;
          data: unknown[];
        };
        return {
          run,
          pollResult: {
            runId: run.runId,
            datasetId: completedResult.dataset_id ?? run.datasetId,
            status: completedResult.status,
            data: completedResult.data,
          },
        };
      } else if (result.status === "FAILED") {
        return {
          run,
          pollResult: {
            runId: run.runId,
            datasetId: result.dataset_id ?? run.datasetId,
            status: result.status,
          },
        };
      }

      return null; // Still running
    });

    const pollResults = await Promise.all(pollPromises);

    // Process completed runs
    for (const pollResult of pollResults) {
      if (pollResult?.pollResult) {
        results.push(pollResult.pollResult);
        pendingRuns.delete(pollResult.run.runId);
      }
    }

    // If there are still pending runs, wait before next poll cycle
    if (pendingRuns.size > 0) {
      await wait.for({ seconds: 10 });
    }
  }

  return results;
}

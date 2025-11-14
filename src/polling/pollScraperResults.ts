import { logger, wait } from "@trigger.dev/sdk/v3";
import { getScraperResults } from "../recoup/getScraperResults";

// Base type with shared fields
type ScrapeRun = {
  runId: string;
  datasetId: string;
};

export type PollResult = ScrapeRun & {
  status: string;
  data?: unknown[];
};

/**
 * Polls each scraper run until all are completed (SUCCEEDED or FAILED).
 * Returns an array of results for each run.
 */
export async function pollScraperResults(
  runs: ScrapeRun[]
): Promise<PollResult[]> {
  const results: PollResult[] = [];

  for (const run of runs) {
    let completed = false;

    while (!completed) {
      await wait.for({ seconds: 10 }); // Wait 10 seconds between polls

      const result = await getScraperResults(run.runId);

      if (!result) {
        logger.warn("Failed to get scraper result", { runId: run.runId });
        continue;
      }

      logger.log("Scraper status check", {
        runId: run.runId,
        status: result.status,
      });

      if (result.status === "SUCCEEDED") {
        const completedResult = result as {
          status: string;
          datasetId: string;
          data: unknown[];
        };
        results.push({
          runId: run.runId,
          datasetId: completedResult.datasetId,
          status: completedResult.status,
          data: completedResult.data,
        });
        completed = true;
      } else if (result.status === "FAILED") {
        results.push({
          runId: run.runId,
          datasetId: result.datasetId,
          status: result.status,
        });
        completed = true;
      }
      // Otherwise still running, continue polling
    }
  }

  return results;
}

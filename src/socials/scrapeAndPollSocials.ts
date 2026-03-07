import { metadata } from "@trigger.dev/sdk/v3";
import { scrapeSocial } from "../recoup/scrapeSocial";
import { pollScraperResults } from "../polling/pollScraperResults";
import { logStep } from "../sandboxes/logStep";
import type { ScrapableSocial } from "./filterScrapableSocials";
import type { PollResult } from "../polling/pollScraperResults";

export const SCRAPE_BATCH_SIZE = 10;

/**
 * Scrapes and polls socials in batches, waiting for each batch to complete before starting the next.
 * Returns an array of poll results for all completed scrapes.
 */
export async function scrapeAndPollSocials(
  socials: ScrapableSocial[],
  batchSize: number = SCRAPE_BATCH_SIZE
): Promise<PollResult[]> {
  const allResults: PollResult[] = [];

  for (let i = 0; i < socials.length; i += batchSize) {
    const socialBatch = socials.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(socials.length / batchSize);

    // Start scrapes for this batch
    const scrapeResults = await Promise.all(
      socialBatch.map((social) => scrapeSocial(social.socialId))
    );

    // Collect valid runs from this batch
    const batchRuns: Array<{ runId: string; datasetId: string }> = [];
    const startedScrapes: Array<{
      artistId: string;
      socialId: string;
      username: string;
      runId: string;
      datasetId: string;
    }> = [];

    for (let j = 0; j < scrapeResults.length; j++) {
      const scrapeResult = scrapeResults[j];
      const social = socialBatch[j];

      if (!scrapeResult) {
        logStep(
          `Skipped ${social.username} (${social.socialId}): scrape failed to start`,
          false,
          { artistId: social.artistId, socialId: social.socialId },
        );
        continue;
      }

      if (scrapeResult.error) {
        logStep(
          `Skipped ${social.username} (${social.socialId}): ${scrapeResult.error}`,
          false,
          { artistId: social.artistId, socialId: social.socialId, error: scrapeResult.error },
        );
        continue;
      }

      if (!scrapeResult.runId || !scrapeResult.datasetId) {
        logStep(
          `Skipped ${social.username} (${social.socialId}): null runId or datasetId`,
          false,
          {
            artistId: social.artistId,
            socialId: social.socialId,
            runId: scrapeResult.runId,
            datasetId: scrapeResult.datasetId,
          },
        );
        continue;
      }

      batchRuns.push({
        runId: scrapeResult.runId,
        datasetId: scrapeResult.datasetId,
      });

      startedScrapes.push({
        artistId: social.artistId,
        socialId: social.socialId,
        username: social.username,
        runId: scrapeResult.runId,
        datasetId: scrapeResult.datasetId,
      });
    }

    // Track successfully started scrapes for this batch
    if (startedScrapes.length > 0) {
      logStep(
        `Started batch ${batchNumber}/${totalBatches} (${startedScrapes.length} scrapes)`,
        true,
        { scrapes: startedScrapes },
      );
    }

    // Poll this batch to completion before moving to next batch
    const batchResults = await pollScraperResults(batchRuns);

    const succeeded = batchResults.filter((r) => r.status === "SUCCEEDED").length;
    const failed = batchResults.filter((r) => r.status === "FAILED").length;

    logStep(
      `Batch ${batchNumber}/${totalBatches} completed: ${succeeded} succeeded, ${failed} failed`,
      true,
      { total: batchResults.length, succeeded, failed, results: batchResults },
    );

    allResults.push(...batchResults);
  }

  return allResults;
}

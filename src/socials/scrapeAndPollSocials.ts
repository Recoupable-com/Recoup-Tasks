import { logger } from "@trigger.dev/sdk/v3";
import { scrapeSocial } from "../recoup/scrapeSocial";
import { pollScraperResults } from "../polling/pollScraperResults";
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
        logger.warn("Failed to start scrape for social", {
          artistId: social.artistId,
          socialId: social.socialId,
          username: social.username,
        });
        continue;
      }

      if (scrapeResult.error) {
        logger.warn("Scrape error for social", {
          artistId: social.artistId,
          socialId: social.socialId,
          username: social.username,
          error: scrapeResult.error,
        });
        continue;
      }

      batchRuns.push({
        runId: scrapeResult.runId!,
        datasetId: scrapeResult.datasetId!,
      });

      startedScrapes.push({
        artistId: social.artistId,
        socialId: social.socialId,
        username: social.username,
        runId: scrapeResult.runId!,
        datasetId: scrapeResult.datasetId!,
      });
    }

    // Log all successfully started scrapes for this batch
    if (startedScrapes.length > 0) {
      logger.log(
        `Started scrapes for batch ${batchNumber} of ${totalBatches}`,
        {
          count: startedScrapes.length,
          scrapes: startedScrapes,
        }
      );
    }

    // Poll this batch to completion before moving to next batch
    logger.log(`Polling batch ${batchNumber} runs to completion`, {
      batchRuns: batchRuns.length,
      runIds: batchRuns.map((r) => r.runId),
    });

    const batchResults = await pollScraperResults(batchRuns);

    logger.log(`Batch ${batchNumber} completed`, {
      total: batchResults.length,
      succeeded: batchResults.filter((r) => r.status === "SUCCEEDED").length,
      failed: batchResults.filter((r) => r.status === "FAILED").length,
      results: batchResults,
    });

    allResults.push(...batchResults);
  }

  return allResults;
}

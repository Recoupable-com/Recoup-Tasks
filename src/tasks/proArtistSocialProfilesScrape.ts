import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { getArtistSocials } from "../recoup/getArtistSocials";
import { scrapeSocial } from "../recoup/scrapeSocial";
import { pollScraperResults } from "../polling/pollScraperResults";
import { getProArtists } from "../recoup/getProArtists";
import { getBatchArtistSocials } from "../artists/getBatchArtistSocials";
import { isScrapableSocial } from "../artists/isScrapableSocial";

export const proArtistSocialProfilesScrape = task({
  id: "pro-artist-social-profiles-scrape",
  maxDuration: 22 * 60,
  run: async () => {
    logger.log("proArtistSocialProfilesScrape", {});

    // Step 1: Fetch pro artists
    const allArtistIds = await getProArtists();

    if (!allArtistIds || allArtistIds.length === 0) {
      throw new Error("Failed to fetch pro artists or no artists found");
    }

    // Limit to first 22 for testing
    const artistIds = allArtistIds.slice(0, 10);

    logger.log("Fetched pro artists", {
      total: allArtistIds.length,
      processing: artistIds.length,
      artistIds,
    });

    // Step 2: Get all socials for all artists (in batches)
    const BATCH_SIZE = 10;
    const artistSocialsMap = await getBatchArtistSocials(artistIds, BATCH_SIZE);

    // Step 2b: Log all socials for visibility
    for (const artistId of artistIds) {
      const socials = artistSocialsMap.get(artistId);

      if (!socials || socials.length === 0) {
        logger.warn("No socials found for artist", { artistId });
        continue;
      }
    }

    // Step 3: Scrape all socials (in batches)
    const allRuns: Array<{ runId: string; datasetId: string }> = [];
    const allSocials: Array<{
      artistId: string;
      socialId: string;
      username: string;
      profile_url: string;
    }> = [];

    // Collect all scrapable socials to scrape
    for (const artistId of artistIds) {
      const socials = artistSocialsMap.get(artistId);
      if (!socials) continue;

      for (const social of socials) {
        // Filter out non-scrapable socials (e.g., Spotify)
        if (!isScrapableSocial(social)) {
          logger.log("Skipping non-scrapable social", {
            artistId,
            socialId: social.social_id,
            username: social.username,
            profile_url: social.profile_url,
          });
          continue;
        }

        allSocials.push({
          artistId,
          socialId: social.social_id,
          username: social.username,
          profile_url: social.profile_url,
        });
      }
    }

    logger.log("Total socials to scrape", {
      totalSocials: allSocials.length,
      allSocials,
    });

    // Scrape in batches
    const SCRAPE_BATCH_SIZE = 3;
    for (let i = 0; i < allSocials.length; i += SCRAPE_BATCH_SIZE) {
      const socialBatch = allSocials.slice(i, i + SCRAPE_BATCH_SIZE);
      logger.log(
        `Scraping batch ${Math.floor(i / SCRAPE_BATCH_SIZE) + 1} of ${Math.ceil(
          allSocials.length / SCRAPE_BATCH_SIZE
        )}`,
        {
          batchStart: i + 1,
          batchEnd: Math.min(i + SCRAPE_BATCH_SIZE, allSocials.length),
          batchSize: socialBatch.length,
        }
      );

      const scrapeResults = await Promise.all(
        socialBatch.map((social) => scrapeSocial(social.socialId))
      );

      // Step 3a: Collect valid runs
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

        if (!scrapeResult.runId || !scrapeResult.datasetId) {
          logger.warn("Invalid scrape response for social", {
            artistId: social.artistId,
            socialId: social.socialId,
            username: social.username,
            scrapeResult,
          });
          continue;
        }

        allRuns.push({
          runId: scrapeResult.runId,
          datasetId: scrapeResult.datasetId,
        });

        logger.log("Started scrape for social", {
          artistId: social.artistId,
          socialId: social.socialId,
          username: social.username,
          runId: scrapeResult.runId,
          datasetId: scrapeResult.datasetId,
        });
      }

      await wait.for({ seconds: 1 });
    }

    if (allRuns.length === 0) {
      throw new Error("No valid scrape runs started for any artist");
    }

    logger.log("Started all scrape runs", {
      totalRuns: allRuns.length,
      totalArtists: artistIds.length,
      runIds: allRuns.map((r) => r.runId),
    });

    // Step 4: Poll all runs
    const results = await pollScraperResults(allRuns);

    logger.log("All scrape runs completed", {
      total: results.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      results,
    });

    return {
      totalArtists: artistIds.length,
      totalRuns: allRuns.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
    };
  },
});

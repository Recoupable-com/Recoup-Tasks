import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getProArtists } from "../recoup/getProArtists";
import { getBatchArtistSocials } from "../artists/getBatchArtistSocials";
import { filterScrapableSocials } from "../socials/filterScrapableSocials";
import { scrapeAndPollSocials } from "../socials/scrapeAndPollSocials";

export const proArtistSocialProfilesScrape = schedules.task({
  id: "pro-artist-social-profiles-scrape",
  cron: {
    pattern: "0 0 * * *", // Daily at midnight
    timezone: "America/New_York", // Eastern Time (handles DST automatically)
  },
  maxDuration: 60 * 60, // 1 hour
  retry: {
    maxAttempts: 1, // Do not retry
  },
  run: async () => {
    // Fetch pro artists
    const allArtistIds = await getProArtists();

    if (!allArtistIds || allArtistIds.length === 0) {
      throw new Error("Failed to fetch pro artists or no artists found");
    }

    const artistIds = allArtistIds;

    logger.log("Fetched pro artists", {
      total: allArtistIds.length,
      processing: artistIds?.length,
      artistIds,
    });

    // Get all socials for all artists
    const artistSocialsMap = await getBatchArtistSocials(artistIds);

    // Log artists missing socials for visibility
    artistIds
      .filter(
        (artistId) =>
          !artistSocialsMap.get(artistId) ||
          artistSocialsMap.get(artistId)?.length === 0
      )
      .forEach((artistId) => {
        logger.warn("No socials found for artist", { artistId });
      });

    // Filter scrapable socials
    const allSocials = filterScrapableSocials(artistIds, artistSocialsMap);

    logger.log("Total socials to scrape", {
      totalSocials: allSocials.length,
      allSocials,
    });

    // Scrape and poll all socials in batches
    const allResults = await scrapeAndPollSocials(allSocials);

    if (allResults.length === 0) {
      throw new Error("No valid scrape runs completed for any artist");
    }

    logger.log("All scrape batches completed", {
      totalRuns: allResults.length,
      totalArtists: artistIds.length,
      succeeded: allResults.filter((r) => r.status === "SUCCEEDED").length,
      failed: allResults.filter((r) => r.status === "FAILED").length,
    });

    return {
      totalArtists: artistIds.length,
      totalRuns: allResults.length,
      succeeded: allResults.filter((r) => r.status === "SUCCEEDED").length,
      failed: allResults.filter((r) => r.status === "FAILED").length,
    };
  },
});

import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { scrapeArtistSocials } from "../recoup/scrapeArtistSocials";
import { getArtistSocials } from "../recoup/getArtistSocials";
import { pollScraperResults } from "../polling/pollScraperResults";

type ArtistSocialProfilesPayload = {
  artist_account_id?: string;
};

export const artistSocialProfilesScrape = task({
  id: "artist-social-profiles-scrape",
  run: async (payload: ArtistSocialProfilesPayload) => {
    const artistAccountId = payload.artist_account_id;
    logger.log("artistSocialProfilesScrape", { artistAccountId });
    if (!artistAccountId) {
      throw new Error(
        "artist-social-profiles-scrape requires an artist_account_id payload"
      );
    }

    // Step 1: Kick off scraping jobs for all social profiles
    logger.log("Starting scrape for artist social profiles", {
      artist_account_id: artistAccountId,
    });

    const scrapeResponses = await scrapeArtistSocials(artistAccountId);

    if (!scrapeResponses) {
      throw new Error("Failed to start artist social scrape");
    }

    // Filter out any responses with errors
    const validRuns = scrapeResponses.filter((r) => !r.error);
    const errorRuns = scrapeResponses.filter((r) => r.error);

    if (errorRuns.length > 0) {
      logger.warn("Some scrape runs failed to start", {
        errors: errorRuns.map((r) => ({ runId: r.runId, error: r.error })),
      });
    }

    if (validRuns.length === 0) {
      throw new Error("No valid scrape runs started");
    }

    logger.log("Started scrape runs", {
      total: validRuns.length,
      runIds: validRuns.map((r) => r.runId),
    });

    // Step 2: Poll each runId until all are completed
    const results = await pollScraperResults(validRuns);

    logger.log("All scrape runs completed", {
      total: results.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      results,
    });

    // Step 3: Fetch updated artist socials after scraping is complete
    // Wait 10 seconds to ensure webhooks finish firing to update the data
    logger.log("Waiting 10 seconds for webhooks to complete", {
      artist_account_id: artistAccountId,
    });
    await wait.for({ seconds: 10 });

    logger.log("Fetching updated artist socials", {
      artist_account_id: artistAccountId,
    });

    const updatedSocials = await getArtistSocials(artistAccountId);

    if (!updatedSocials) {
      logger.warn("Failed to fetch updated artist socials", {
        artist_account_id: artistAccountId,
      });
    } else {
      logger.log("Fetched updated artist socials", {
        artist_account_id: artistAccountId,
        total: updatedSocials.length,
        socials: updatedSocials,
      });
    }

    return {
      artist_account_id: artistAccountId,
      totalRuns: results.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      results,
      updatedSocials: updatedSocials || undefined,
    };
  },
});

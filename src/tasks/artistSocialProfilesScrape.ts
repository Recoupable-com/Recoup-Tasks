import { logger, task, wait } from "@trigger.dev/sdk/v3";
import { scrapeArtistSocials } from "../recoup/scrapeArtistSocials";
import { getArtistSocials } from "../recoup/getArtistSocials";
import { pollScraperResults } from "../polling/pollScraperResults";
import { generateChat } from "../recoup/generateChat";
import {
  chatSchema,
  type ChatConfig,
  DEFAULT_ROOM_ID,
} from "../schemas/chatSchema";

type ArtistSocialProfilesPayload = ChatConfig;

export const artistSocialProfilesScrape = task({
  id: "artist-social-profiles-scrape",
  maxDuration: 22 * 60,
  run: async (payload: ArtistSocialProfilesPayload) => {
    const artistId = payload.artistId;
    logger.log("artistSocialProfilesScrape", { artistId });
    if (!artistId) {
      throw new Error(
        "artist-social-profiles-scrape requires an artistId payload"
      );
    }

    // Step 1: Kick off scraping jobs for all social profiles
    logger.log("Starting scrape for artist social profiles", {
      artistId,
    });

    const scrapeResponses = await scrapeArtistSocials(artistId);

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
      artistId,
    });
    await wait.for({ seconds: 10 });

    logger.log("Fetching updated artist socials", {
      artistId,
    });

    const updatedSocials = await getArtistSocials(artistId);

    if (!updatedSocials) {
      logger.warn("Failed to fetch updated artist socials", {
        artistId,
      });
    } else {
      logger.log("Fetched updated artist socials", {
        artistId,
        total: updatedSocials.length,
        socials: updatedSocials,
      });
    }

    // Step 4: Generate chat response if task config is provided
    const taskConfigValidation = chatSchema.safeParse(payload);
    const taskConfig = taskConfigValidation.success
      ? taskConfigValidation.data
      : {};

    const accountId = taskConfig.accountId;
    const roomId = taskConfig.roomId ?? DEFAULT_ROOM_ID;
    const prompt =
      taskConfig.prompt ??
      "Summarize the updated artist social profiles that were just scraped.";

    if (accountId) {
      logger.log("Generating chat response", {
        artistId,
        accountId,
        roomId,
        prompt,
      });

      await generateChat({
        prompt,
        accountId,
        roomId,
        artistId,
      });
    } else {
      logger.log("Skipping chat generation - no accountId provided", {
        artistId,
      });
    }

    return {
      artistId,
      totalRuns: results.length,
      succeeded: results.filter((r) => r.status === "SUCCEEDED").length,
      failed: results.filter((r) => r.status === "FAILED").length,
      results,
      updatedSocials: updatedSocials || undefined,
    };
  },
});

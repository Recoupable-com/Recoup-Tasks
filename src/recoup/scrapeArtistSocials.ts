import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const scrapeResponseSchema = z.array(
  z.object({
    runId: z.string(),
    datasetId: z.string(),
    error: z.string().nullable(),
  })
);

export type ScrapeResponse = z.infer<typeof scrapeResponseSchema>[number];

const ARTIST_SOCIALS_SCRAPE_API_URL =
  "https://api.recoupable.com/api/artist/socials/scrape";

/**
 * Kicks off scraping jobs for all social profiles linked to an artist.
 * Returns an array of Apify run metadata for each social profile.
 */
export async function scrapeArtistSocials(
  artistAccountId: string
): Promise<ScrapeResponse[] | undefined> {
  if (!artistAccountId) {
    logger.error("scrapeArtistSocials called without artistAccountId");
    return undefined;
  }

  try {
    const response = await fetch(ARTIST_SOCIALS_SCRAPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        artist_account_id: artistAccountId,
      }),
    });

    if (!response.ok) {
      logger.error("Recoup Artist Social Scrape API error", {
        artistAccountId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = scrapeResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid response from Recoup Artist Social Scrape API", {
        artistAccountId,
        errors: validation.error.issues,
      });
      return undefined;
    }

    return validation.data;
  } catch (error) {
    logger.error("Failed to scrape artist socials from Recoup API", {
      artistAccountId,
      error,
    });
    return undefined;
  }
}


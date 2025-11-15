import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const scrapeResponseSchema = z.object({
  runId: z.string().nullable(),
  datasetId: z.string().nullable(),
  error: z.string().optional(),
});

export type ScrapeSocialResponse = z.infer<typeof scrapeResponseSchema>;

const SOCIAL_SCRAPE_API_URL = "https://api.recoupable.com/api/social/scrape";

/**
 * Triggers a social profile scraping job for a given social_id.
 * Returns Apify run metadata that can be used to poll for status and retrieve results.
 */
export async function scrapeSocial(
  socialId: string
): Promise<ScrapeSocialResponse | undefined> {
  if (!socialId) {
    logger.error("scrapeSocial called without socialId");
    return undefined;
  }

  try {
    const response = await fetch(SOCIAL_SCRAPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        social_id: socialId,
      }),
    });

    if (!response.ok) {
      logger.error("Recoup Social Scrape API error", {
        socialId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = scrapeResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid response from Recoup Social Scrape API", {
        socialId,
        errors: validation.error.issues,
      });
      return undefined;
    }

    return validation.data;
  } catch (error) {
    logger.error("Failed to scrape social from Recoup API", {
      socialId,
      error,
    });
    return undefined;
  }
}

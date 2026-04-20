import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const scrapeResponseSchema = z.object({
  runId: z.string().nullable(),
  datasetId: z.string().nullable(),
  error: z.string().optional(),
});

export type ScrapeSocialResponse = z.infer<typeof scrapeResponseSchema>;

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

  if (!RECOUP_API_KEY) {
    logger.error("RECOUP_API_KEY not configured");
    return undefined;
  }

  const url = `${NEW_API_BASE_URL}/api/socials/${socialId}/scrape`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY,
      },
      body: JSON.stringify({}),
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

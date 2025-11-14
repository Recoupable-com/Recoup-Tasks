import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";

// Base schema with shared fields
const inProgressResponseSchema = z.object({
  status: z.string(),
  datasetId: z.string(),
});

// Completed response (base + data field)
const completedResponseSchema = inProgressResponseSchema.extend({
  data: z.array(z.unknown()),
});

type ScraperResponse =
  | z.infer<typeof inProgressResponseSchema>
  | z.infer<typeof completedResponseSchema>;

const APIFY_SCRAPER_API_URL = "https://api.recoupable.com/api/apify/scraper";

/**
 * Checks the status and retrieves results from an Apify scraper run.
 * Returns the response with status and data (if completed).
 */
export async function getScraperResults(
  runId: string
): Promise<ScraperResponse | undefined> {
  if (!runId) {
    logger.error("getScraperResults called without runId");
    return undefined;
  }

  try {
    const url = new URL(APIFY_SCRAPER_API_URL);
    url.searchParams.set("runId", runId);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.error("Recoup Apify Scraper API error", {
        runId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;

    // Try to parse as completed first (has data field)
    const completedValidation = completedResponseSchema.safeParse(json);
    if (completedValidation.success) {
      return completedValidation.data;
    }

    // Otherwise parse as in-progress
    const inProgressValidation = inProgressResponseSchema.safeParse(json);
    if (inProgressValidation.success) {
      return inProgressValidation.data;
    }

    logger.error("Invalid response from Recoup Apify Scraper API", {
      runId,
      errors: [
        ...(completedValidation.error?.issues || []),
        ...(inProgressValidation.error?.issues || []),
      ],
    });
    return undefined;
  } catch (error) {
    logger.error("Failed to get scraper results from Recoup API", {
      runId,
      error,
    });
    return undefined;
  }
}


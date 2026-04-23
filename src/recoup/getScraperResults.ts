import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const inProgressResponseSchema = z.object({
  status: z.string(),
  dataset_id: z.string().nullable(),
});

const completedResponseSchema = inProgressResponseSchema.extend({
  data: z.array(z.unknown()),
});

type ScraperResponse =
  | z.infer<typeof inProgressResponseSchema>
  | z.infer<typeof completedResponseSchema>;

/**
 * Polls an Apify run's status and results via GET /api/apify/runs/{runId}.
 */
export async function getScraperResults(
  runId: string
): Promise<ScraperResponse | undefined> {
  if (!runId) {
    logger.error("getScraperResults called without runId");
    return undefined;
  }

  if (!RECOUP_API_KEY) {
    logger.error("RECOUP_API_KEY not configured");
    return undefined;
  }

  try {
    const response = await fetch(
      `${NEW_API_BASE_URL}/api/apify/runs/${encodeURIComponent(runId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": RECOUP_API_KEY,
        },
      }
    );

    if (!response.ok) {
      logger.error("Recoup Apify Scraper API error", {
        runId,
        status: response.status,
        statusText: response.statusText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;

    const completedValidation = completedResponseSchema.safeParse(json);
    if (completedValidation.success) {
      return completedValidation.data;
    }

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

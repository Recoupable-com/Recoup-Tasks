import { z } from "zod";
import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL } from "../consts";

const accountEmailsResponseSchema = z.object({
  status: z.literal("success"),
  emails: z.array(z.object({ id: z.string() })).default([]),
});

/**
 * Fetches the most recent Resend email ID for an account via GET /api/admins/emails.
 *
 * @param accountId - The account ID to query
 * @param apiKey - The API key for authentication
 * @returns The Resend email ID or null if not found
 */
export async function fetchLatestAccountEmailId(
  accountId: string,
  apiKey: string,
): Promise<string | null> {
  const url = `${NEW_API_BASE_URL}/api/admins/emails?account_id=${encodeURIComponent(accountId)}`;

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("Failed to fetch account emails", {
        status: response.status,
        statusText: response.statusText,
        url,
        body: errorBody.slice(0, 500),
      });
      return null;
    }

    const json = await response.json();
    const parsed = accountEmailsResponseSchema.safeParse(json);

    if (!parsed.success) {
      logger.error("Invalid account emails response", {
        issues: parsed.error.issues,
      });
      return null;
    }

    return parsed.data.emails[0]?.id ?? null;
  } catch (error) {
    logger.error("Error fetching account emails", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL } from "../consts";

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
  const url = `${NEW_API_BASE_URL}/api/admins/emails?account_id=${accountId}`;

  try {
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      logger.error("Failed to fetch account emails", {
        status: response.status,
      });
      return null;
    }

    const json = await response.json();
    const emails = json.emails ?? [];

    if (emails.length === 0) return null;

    return emails[0].id;
  } catch (error) {
    logger.error("Error fetching account emails", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

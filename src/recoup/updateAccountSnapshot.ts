import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

/**
 * Updates sandbox config for an account via PATCH /api/sandboxes.
 *
 * @param accountId - The account ID to update
 * @param _snapshotId - Deprecated, unused. Kept for call-site compat during migration.
 * @param githubRepo - Optional GitHub repo URL to persist
 * @returns The updated data or undefined on error
 */
export async function updateAccountSnapshot(
  accountId: string,
  _snapshotId?: string,
  githubRepo?: string
): Promise<{ success: boolean } | undefined> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes`;

  logger.log("Updating account sandbox metadata", { accountId, githubRepo, url });

  try {
    const body: Record<string, string> = { account_id: accountId };
    if (githubRepo) {
      body.github_repo = githubRepo;
    }

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to update account sandbox metadata", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return undefined;
    }

    const data = await response.json();

    logger.log("Account sandbox metadata updated successfully", {
      accountId,
    });

    return data;
  } catch (error) {
    logger.error("Error updating account sandbox metadata", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

/**
 * Persists the GitHub repo URL for an account via PATCH /api/sandboxes.
 *
 * @param accountId - The account ID to update
 * @param githubRepo - The GitHub repo URL to set
 * @returns true if the update succeeded, false otherwise
 */
export async function updateAccountGithubRepo(
  accountId: string,
  githubRepo: string
): Promise<boolean> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes`;

  logger.log("Persisting GitHub repo for account", {
    accountId,
    githubRepo,
    url,
  });

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
      },
      body: JSON.stringify({ account_id: accountId, github_repo: githubRepo }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to persist GitHub repo", {
        status: response.status,
        error: errorText,
      });
      return false;
    }

    logger.log("GitHub repo persisted successfully", {
      accountId,
      githubRepo,
    });

    return true;
  } catch (error) {
    logger.error("Error persisting GitHub repo", {
      accountId,
      githubRepo,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

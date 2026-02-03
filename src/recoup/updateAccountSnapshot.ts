import { logger } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

/**
 * Updates the snapshot ID for an account via PATCH /api/sandboxes.
 *
 * @param accountId - The account ID to update
 * @param snapshotId - The snapshot ID to set
 * @returns The updated snapshot data or undefined on error
 */
export async function updateAccountSnapshot(
  accountId: string,
  snapshotId: string
): Promise<{ success: boolean; snapshotId: string } | undefined> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes`;

  logger.log("Updating account snapshot", { accountId, snapshotId, url });

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
        "x-account-id": accountId,
      },
      body: JSON.stringify({ snapshotId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to update account snapshot", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return undefined;
    }

    const data = await response.json();

    logger.log("Account snapshot updated successfully", {
      accountId,
      snapshotId: data.snapshotId,
    });

    return data;
  } catch (error) {
    logger.error("Error updating account snapshot", {
      accountId,
      snapshotId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

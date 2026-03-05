import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const accountSandboxesResponseSchema = z.object({
  status: z.literal("success"),
  snapshot_id: z.string().nullable(),
  github_repo: z.string().nullable(),
});

export interface AccountSandboxesInfo {
  snapshotId: string | null;
  githubRepo: string | null;
}

/**
 * Fetches sandbox info for an account via GET /api/sandboxes.
 *
 * @param accountId - The account ID to look up
 * @returns The snapshot ID and github repo URL, or undefined on error
 */
export async function getAccountSandboxes(
  accountId: string
): Promise<AccountSandboxesInfo | undefined> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes?account_id=${encodeURIComponent(
    accountId
  )}`;

  logger.log("Fetching account sandboxes", { accountId, url });

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to fetch account sandboxes", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = accountSandboxesResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid sandboxes response", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    logger.log("Account sandboxes fetched", {
      accountId,
      validation,
    });

    return {
      snapshotId: validation.data.snapshot_id,
      githubRepo: validation.data.github_repo,
    };
  } catch (error) {
    logger.error("Error fetching account sandboxes", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

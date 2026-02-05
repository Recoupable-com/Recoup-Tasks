import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const accountResponseSchema = z.object({
  status: z.literal("success"),
  account: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

export interface AccountInfo {
  id: string;
  name: string;
}

/**
 * Fetches account info via GET /api/accounts/{id}.
 *
 * @param accountId - The account ID to look up
 * @returns The account id and name, or undefined on error
 */
export async function getAccount(
  accountId: string
): Promise<AccountInfo | undefined> {
  const url = `${NEW_API_BASE_URL}/api/accounts/${encodeURIComponent(accountId)}`;

  logger.log("Fetching account info", { accountId, url });

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
      logger.error("Failed to fetch account", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = accountResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid account response", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    logger.log("Account info fetched", {
      accountId,
      name: validation.data.account.name,
    });

    return {
      id: validation.data.account.id,
      name: validation.data.account.name,
    };
  } catch (error) {
    logger.error("Error fetching account", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

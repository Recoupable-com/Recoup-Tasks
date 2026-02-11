import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const sandboxEntrySchema = z.object({
  sandboxId: z.string(),
  sandboxStatus: z.enum(["pending", "running", "stopping", "stopped", "failed"]),
});

const createSandboxResponseSchema = z.object({
  status: z.literal("success"),
  sandboxes: z.array(sandboxEntrySchema).min(1),
});

/**
 * Creates a new sandbox for an account via POST /api/sandboxes.
 *
 * @param accountId - The account ID to create a sandbox for
 * @returns The created sandbox ID, or undefined on error
 */
export async function createAccountSandbox(
  accountId: string
): Promise<{ sandboxId: string } | undefined> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes?account_id=${encodeURIComponent(accountId)}`;

  logger.log("Creating account sandbox", { accountId, url });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY || "",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to create account sandbox", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = createSandboxResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid create sandbox response", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    const { sandboxId } = validation.data.sandboxes[0];

    logger.log("Account sandbox created", {
      accountId,
      sandboxId,
    });

    return { sandboxId };
  } catch (error) {
    logger.error("Error creating account sandbox", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

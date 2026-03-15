import { logger } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { NEW_API_BASE_URL, RECOUP_API_KEY } from "../consts";

const sandboxEntrySchema = z.object({
  sandboxId: z.string(),
  sandboxStatus: z.enum(["pending", "running", "stopping", "stopped", "failed"]),
  timeout: z.number(),
  createdAt: z.string(),
  runId: z.string().optional(),
});

const executePulseResponseSchema = z.object({
  status: z.literal("success"),
  sandboxes: z.array(sandboxEntrySchema).min(1),
});

/**
 * Executes a pulse in a sandbox by calling POST /api/sandboxes with a prompt.
 * The API creates/resumes a sandbox and runs the prompt via OpenClaw.
 *
 * @param params.accountId - The account ID to execute the pulse for
 * @param params.prompt - The pulse prompt to execute
 * @param root0
 * @param root0.accountId
 * @param root0.prompt
 * @returns The sandbox ID and run ID on success, undefined on error
 */
export async function executePulseInSandbox({
  accountId,
  prompt,
}: {
  accountId: string;
  prompt: string;
}): Promise<{ sandboxId: string; runId: string | undefined } | undefined> {
  const url = `${NEW_API_BASE_URL}/api/sandboxes`;

  if (!RECOUP_API_KEY) {
    throw new Error("RECOUP_API_KEY not configured");
  }

  logger.log("Executing pulse in sandbox", { accountId, url });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RECOUP_API_KEY,
      },
      body: JSON.stringify({ account_id: accountId, prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to execute pulse in sandbox", {
        status: response.status,
        error: errorText,
      });
      return undefined;
    }

    const json = (await response.json()) as unknown;
    const validation = executePulseResponseSchema.safeParse(json);

    if (!validation.success) {
      logger.error("Invalid execute pulse response", {
        errors: validation.error.issues,
      });
      return undefined;
    }

    const { sandboxId, runId } = validation.data.sandboxes[0];

    logger.log("Pulse sandbox execution started", {
      accountId,
      sandboxId,
      runId,
    });

    return { sandboxId, runId };
  } catch (error) {
    logger.error("Error executing pulse in sandbox", {
      accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

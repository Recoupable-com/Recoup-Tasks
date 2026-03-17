import { tags } from "@trigger.dev/sdk/v3";
import { pollSandboxUntilStopped } from "./pollSandboxUntilStopped";
import { fetchLatestAccountEmailId } from "./fetchLatestAccountEmailId";
import { logStep } from "../sandboxes/logStep";
import { RECOUP_API_KEY } from "../consts";

/**
 * Waits for a sandbox to stop, then tags the current task run with the
 * most recent Resend email ID for the account.
 *
 * @param sandboxId - The sandbox to poll
 * @param accountId - The account to fetch emails for
 */
export async function tagPulseEmailId(
  sandboxId: string,
  accountId: string,
): Promise<void> {
  if (!RECOUP_API_KEY) {
    logStep("Skipping email tagging: RECOUP_API_KEY not configured", false);
    return;
  }

  try {
    await pollSandboxUntilStopped(sandboxId, RECOUP_API_KEY);

    const emailId = await fetchLatestAccountEmailId(accountId, RECOUP_API_KEY);
    if (emailId) {
      await tags.add(`email:${emailId}`);
      logStep("Tagged with email ID", false, { emailId });
    }
  } catch (error) {
    logStep("Failed to tag email ID (sandbox poll timeout or error)", false, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

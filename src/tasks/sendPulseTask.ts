import { tags, task } from "@trigger.dev/sdk/v3";
import { executePulseInSandbox } from "../pulse/executePulseInSandbox";
import { pollSandboxUntilStopped } from "../pulse/pollSandboxUntilStopped";
import { fetchLatestAccountEmailId } from "../pulse/fetchLatestAccountEmailId";
import { logStep } from "../sandboxes/logStep";
import { RECOUP_API_KEY } from "../consts";

/**
 * Task that executes a pulse for a single account.
 * Tagged with account:<accountId> for querying via GET /api/tasks/runs?account_id=<id>.
 * After sandbox stops, fetches the latest email for the account and adds email:<emailId> tag.
 */
export const sendPulseTask = task({
  id: "send-pulse-task",
  run: async ({ accountId, prompt }: { accountId: string; prompt: string }) => {
    logStep("Executing pulse for account", true, { accountId });

    const result = await executePulseInSandbox({ accountId, prompt });

    if (!result) {
      throw new Error(`Failed to execute pulse in sandbox for account ${accountId}`);
    }

    // Wait for sandbox to finish, then tag with the email ID
    if (!RECOUP_API_KEY) {
      logStep("Skipping email tagging: RECOUP_API_KEY not configured", false);
    } else {
      try {
        await pollSandboxUntilStopped(result.sandboxId, RECOUP_API_KEY);

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

    logStep("Pulse executed successfully", true, { accountId, ...result });

    return result;
  },
});

import { task } from "@trigger.dev/sdk/v3";
import { executePulseInSandbox } from "../pulse/executePulseInSandbox";
import { logStep } from "../sandboxes/logStep";

/**
 * Task that executes a pulse for a single account.
 * Tagged with account:<accountId> for easy querying via GET /api/tasks/runs?account_id=<id>.
 */
export const sendPulseTask = task({
  id: "send-pulse-task",
  run: async ({ accountId, prompt }: { accountId: string; prompt: string }) => {
    logStep("Executing pulse for account", true, { accountId });

    const result = await executePulseInSandbox({ accountId, prompt });

    if (!result) {
      throw new Error(`Failed to execute pulse in sandbox for account ${accountId}`);
    }

    logStep("Pulse executed successfully", true, { accountId, ...result });

    return result;
  },
});

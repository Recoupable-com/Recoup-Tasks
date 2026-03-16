import { logger, task } from "@trigger.dev/sdk/v3";
import { executePulseInSandbox } from "../pulse/executePulseInSandbox";

/**
 * Task that executes a pulse for a single account.
 * Tagged with account:<accountId> for easy querying via GET /api/tasks/runs?account_id=<id>.
 */
export const sendPulseTask = task({
  id: "send-pulse-task",
  run: async ({ accountId, prompt }: { accountId: string; prompt: string }) => {
    logger.log("Executing pulse for account", { accountId });

    const result = await executePulseInSandbox({ accountId, prompt });

    if (!result) {
      throw new Error(`Failed to execute pulse in sandbox for account ${accountId}`);
    }

    logger.log("Pulse executed successfully", { accountId, ...result });

    return result;
  },
});

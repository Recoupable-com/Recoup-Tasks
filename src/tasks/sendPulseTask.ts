import { runs, tags, task } from "@trigger.dev/sdk/v3";
import { executePulseInSandbox } from "../pulse/executePulseInSandbox";
import { extractRoomIdFromStdout } from "../pulse/extractRoomIdFromStdout";
import { logStep } from "../sandboxes/logStep";

/**
 * Task that executes a pulse for a single account.
 * Tagged with account:<accountId> for easy querying via GET /api/tasks/runs?account_id=<id>.
 * After execution, polls the child sandbox run for stdout and adds room:<roomId> tag
 * if the agent outputs PULSE_ROOM_ID:<id>.
 */
export const sendPulseTask = task({
  id: "send-pulse-task",
  run: async ({ accountId, prompt }: { accountId: string; prompt: string }) => {
    logStep("Executing pulse for account", true, { accountId });

    const result = await executePulseInSandbox({ accountId, prompt });

    if (!result) {
      throw new Error(`Failed to execute pulse in sandbox for account ${accountId}`);
    }

    // Poll the child sandbox run for stdout to extract room ID
    if (result.runId) {
      try {
        const childRun = await runs.poll(result.runId, { pollIntervalMs: 10000 });
        const stdout = (childRun.output as { stdout?: string })?.stdout ?? "";
        const roomId = extractRoomIdFromStdout(stdout);

        if (roomId) {
          await tags.add(`room:${roomId}`);
          logStep("Added room tag", false, { roomId });
        }
      } catch {
        logStep("Failed to poll child run for room ID", false);
      }
    }

    logStep("Pulse executed successfully", true, { accountId, ...result });

    return result;
  },
});

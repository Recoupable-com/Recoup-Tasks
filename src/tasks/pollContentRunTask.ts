import { schemaTask } from "@trigger.dev/sdk/v3";
import { pollContentRunPayloadSchema } from "../schemas/pollContentRunSchema";
import { logStep } from "../sandboxes/logStep";
import { pollContentRuns } from "../content/pollContentRuns";
import {
  resolveOverallStatus,
  sendContentCallback,
} from "../content/sendContentCallback";

/**
 * Polls Trigger.dev create-content task runs until all are finished,
 * then calls the content-agent callback endpoint with results.
 */
export const pollContentRunTask = schemaTask({
  id: "poll-content-run",
  schema: pollContentRunPayloadSchema,
  maxDuration: 60 * 35,
  retry: {
    maxAttempts: 0,
  },
  run: async payload => {
    const { runIds, callbackThreadId } = payload;

    logStep("Starting poll-content-run", true, { runIds, callbackThreadId });

    const results = await pollContentRuns(runIds);
    const overallStatus = resolveOverallStatus(results);

    await sendContentCallback(callbackThreadId, overallStatus, results);

    return { status: overallStatus, results };
  },
});

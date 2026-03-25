import { logger, schemaTask, wait } from "@trigger.dev/sdk/v3";
import { pollContentRunPayloadSchema } from "../schemas/pollContentRunSchema";
import { runs } from "@trigger.dev/sdk/v3";

const POLL_INTERVAL_SECONDS = 30;
const MAX_ATTEMPTS = 60; // 30 min total

type ContentRunResult = {
  runId: string;
  status: "completed" | "failed" | "timeout";
  videoUrl?: string;
  captionText?: string;
  error?: string;
};

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

    logger.info("Starting poll-content-run", { runIds, callbackThreadId });

    const pendingRunIds = new Set(runIds);
    const results: ContentRunResult[] = [];
    let attempts = 0;

    while (pendingRunIds.size > 0 && attempts < MAX_ATTEMPTS) {
      attempts++;

      for (const runId of Array.from(pendingRunIds)) {
        try {
          const run = await runs.retrieve(runId);

          if (run.status === "COMPLETED") {
            const output = run.output as {
              videoSourceUrl?: string;
              captionText?: string;
            } | null;

            results.push({
              runId,
              status: "completed",
              videoUrl: output?.videoSourceUrl,
              captionText: output?.captionText,
            });
            pendingRunIds.delete(runId);
            logger.info("Run completed", { runId });
          } else if (
            run.status === "FAILED" ||
            run.status === "CANCELED" ||
            run.status === "CRASHED" ||
            run.status === "SYSTEM_FAILURE" ||
            run.status === "INTERRUPTED" ||
            run.status === "EXPIRED"
          ) {
            results.push({
              runId,
              status: "failed",
              error: `Run ${run.status.toLowerCase()}`,
            });
            pendingRunIds.delete(runId);
            logger.warn("Run failed", { runId, status: run.status });
          }
          // Otherwise still running — continue polling
        } catch (error) {
          logger.error("Error retrieving run", { runId, error });
        }
      }

      if (pendingRunIds.size > 0) {
        await wait.for({ seconds: POLL_INTERVAL_SECONDS });
      }
    }

    // Handle any remaining runs as timeout
    for (const runId of pendingRunIds) {
      results.push({ runId, status: "timeout" });
    }

    // Determine overall status
    const allCompleted = results.every(r => r.status === "completed");
    const anyCompleted = results.some(r => r.status === "completed");
    const anyTimeout = results.some(r => r.status === "timeout");

    let overallStatus: "completed" | "failed" | "timeout";
    if (anyTimeout) {
      overallStatus = "timeout";
    } else if (anyCompleted) {
      overallStatus = "completed";
    } else {
      overallStatus = "failed";
    }

    // Call callback endpoint
    const callbackUrl = `${process.env.RECOUP_API_BASE_URL}/api/content-agent/callback`;
    const callbackSecret = process.env.CODING_AGENT_CALLBACK_SECRET;

    logger.info("Calling callback", { callbackUrl, overallStatus, resultCount: results.length });

    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-callback-secret": callbackSecret ?? "",
      },
      body: JSON.stringify({
        threadId: callbackThreadId,
        status: overallStatus,
        results,
      }),
    });

    if (!response.ok) {
      logger.error("Callback failed", {
        status: response.status,
        body: await response.text().catch(() => ""),
      });
    }

    return { status: overallStatus, results };
  },
});

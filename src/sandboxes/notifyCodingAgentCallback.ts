import { logger } from "@trigger.dev/sdk/v3";

interface CallbackPayload {
  threadId: string;
  status: "pr_created" | "no_changes" | "failed" | "updated";
  branch?: string;
  snapshotId?: string;
  prs?: { repo: string; number: number; url: string; baseBranch: string }[];
  message?: string;
  stdout?: string;
  stderr?: string;
}

/**
 * Posts a callback to the coding agent API endpoint to notify
 * the Slack bot of task results.
 *
 * @param payload - The callback payload with thread ID and status
 */
export async function notifyCodingAgentCallback(payload: CallbackPayload): Promise<void> {
  const url = process.env.CODING_AGENT_CALLBACK_URL;
  const secret = process.env.CODING_AGENT_CALLBACK_SECRET;

  if (!url) {
    logger.error("Missing CODING_AGENT_CALLBACK_URL environment variable");
    return;
  }

  logger.log("Sending coding agent callback", {
    threadId: payload.threadId,
    status: payload.status,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-callback-secret": secret || "",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      logger.error("Callback request failed", {
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logger.error("Callback request error", { error });
  }
}

import { logStep } from "../sandboxes/logStep";
import { NEW_API_BASE_URL } from "../consts";
import type { ContentRunResult } from "./pollContentRuns";

/**
 * Sends aggregated content run results to the callback endpoint.
 * Throws on missing env vars or failed callback.
 */
export async function sendContentCallback(
  callbackThreadId: string,
  overallStatus: "completed" | "failed" | "timeout",
  results: ContentRunResult[],
): Promise<void> {
  const callbackSecret = process.env.CODING_AGENT_CALLBACK_SECRET;
  if (!callbackSecret) {
    throw new Error("CODING_AGENT_CALLBACK_SECRET is required");
  }

  const callbackUrl = `${NEW_API_BASE_URL}/api/content-agent/callback`;

  logStep("Calling callback", true, {
    callbackUrl,
    overallStatus,
    resultCount: results.length,
  });

  const response = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-callback-secret": callbackSecret,
    },
    body: JSON.stringify({
      threadId: callbackThreadId,
      status: overallStatus,
      results,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logStep("Callback failed", false, { status: response.status, body });
    throw new Error(`Callback failed with status ${response.status}`);
  }
}

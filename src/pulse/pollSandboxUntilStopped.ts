import { logger, wait } from "@trigger.dev/sdk/v3";
import { NEW_API_BASE_URL } from "../consts";

interface PollOptions {
  maxAttempts?: number;
  intervalSeconds?: number;
}

/**
 * Polls GET /api/sandboxes?sandbox_id=<id> until the sandbox status is "stopped".
 *
 * @param sandboxId - The sandbox ID to poll
 * @param apiKey - The API key for authentication
 * @param options - Polling options
 */
export async function pollSandboxUntilStopped(
  sandboxId: string,
  apiKey: string,
  options: PollOptions = {},
): Promise<void> {
  const { maxAttempts = 60, intervalSeconds = 15 } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = `${NEW_API_BASE_URL}/api/sandboxes?sandbox_id=${sandboxId}`;
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
    });

    if (response.ok) {
      const json = await response.json();
      const sandbox = json.sandboxes?.[0];

      if (sandbox?.sandboxStatus === "stopped") {
        logger.log("Sandbox stopped", { sandboxId, attempt });
        return;
      }
    }

    await wait.for({ seconds: intervalSeconds });
  }

  throw new Error(`Sandbox ${sandboxId} did not stop after ${maxAttempts} attempts`);
}

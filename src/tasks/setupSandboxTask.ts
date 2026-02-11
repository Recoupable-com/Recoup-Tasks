import { logger, schemaTask, wait } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { createAccountSandbox } from "../recoup/createAccountSandbox";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { setupSandboxPayloadSchema } from "../schemas/setupSandboxSchema";

/**
 * Polls until the sandbox reaches "running" status.
 * Throws if the sandbox enters a terminal state or exceeds max attempts.
 */
async function waitForSandboxRunning(
  sandboxId: string,
  credentials: { token: string; teamId: string; projectId: string }
): Promise<Sandbox> {
  const maxAttempts = 15;
  const delayMs = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    const sandbox = await Sandbox.get({ sandboxId, ...credentials });
    logger.log("Polling sandbox status", {
      sandboxId,
      status: sandbox.status,
      attempt: i + 1,
    });

    if (sandbox.status === "running") {
      return sandbox;
    }

    if (
      sandbox.status === "stopped" ||
      sandbox.status === "failed"
    ) {
      throw new Error(
        `Sandbox ${sandboxId} entered terminal state: ${sandbox.status}`
      );
    }

    await wait.for({ seconds: delayMs / 1000 });
  }

  throw new Error(
    `Sandbox ${sandboxId} did not reach running state after ${maxAttempts} attempts`
  );
}

/**
 * Background task that creates a personal Vercel Sandbox for an account,
 * provisions it with a GitHub repository, takes a snapshot, and shuts it down.
 */
export const setupSandboxTask = schemaTask({
  id: "setup-sandbox",
  schema: setupSandboxPayloadSchema,
  maxDuration: 60 * 5, // 5 minutes max
  retry: {
    maxAttempts: 0, // Zero retries — run once only
  },
  run: async (payload) => {
    const { accountId } = payload;
    const credentials = getVercelSandboxCredentials();

    logger.log("Starting sandbox setup", { accountId });

    const created = await createAccountSandbox(accountId);
    if (!created) {
      throw new Error(`Failed to create sandbox for account ${accountId}`);
    }

    const { sandboxId } = created;
    logger.log("Sandbox created via API", { sandboxId });

    const sandbox = await waitForSandboxRunning(sandboxId, credentials);

    logger.log("Sandbox is running", {
      sandboxId: sandbox.sandboxId,
    });

    let snapshotted = false;
    try {
      const githubRepo = await ensureGithubRepo(sandbox, accountId);

      const snapshotResult = await snapshotAndPersist(
        sandbox,
        accountId,
        githubRepo ?? undefined
      );
      snapshotted = true;

      logger.log("Sandbox setup complete", {
        sandboxId: sandbox.sandboxId,
        githubRepo: githubRepo ?? null,
        snapshotId: snapshotResult.snapshotId,
      });

      return {
        githubRepo: githubRepo ?? null,
        snapshotId: snapshotResult.snapshotId,
      };
    } finally {
      if (!snapshotted) {
        logger.log("Stopping sandbox (snapshot did not complete)", {
          sandboxId: sandbox.sandboxId,
        });
        await sandbox.stop();
      }
    }
  },
});

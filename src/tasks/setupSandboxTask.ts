import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { createAccountSandbox } from "../recoup/createAccountSandbox";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { setupSandboxPayloadSchema } from "../schemas/setupSandboxSchema";

/**
 * Background task that creates a personal Vercel Sandbox for an account,
 * provisions it with a GitHub repository, takes a snapshot, and shuts it down.
 */
export const setupSandboxTask = schemaTask({
  id: "setup-sandbox",
  schema: setupSandboxPayloadSchema,
  maxDuration: 60 * 5, // 5 minutes max
  retry: {
    maxAttempts: 1, // Run once — no retries
  },
  run: async (payload) => {
    const { accountId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logger.log("Starting sandbox setup", { accountId });

    const created = await createAccountSandbox(accountId);
    if (!created) {
      throw new Error(`Failed to create sandbox for account ${accountId}`);
    }

    const { sandboxId } = created;
    logger.log("Sandbox created via API", { sandboxId });

    const sandbox = await Sandbox.get({ sandboxId, token, teamId, projectId });

    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    try {
      const githubRepo = await ensureGithubRepo(sandbox, accountId);

      const snapshotResult = await snapshotAndPersist(
        sandbox,
        accountId,
        githubRepo ?? undefined
      );

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
      logger.log("Stopping sandbox", { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

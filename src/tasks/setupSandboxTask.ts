import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { setupSandboxPayloadSchema } from "../schemas/setupSandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox and ensures
 * a GitHub repository is created and cloned.
 */
export const setupSandboxTask = schemaTask({
  id: "setup-sandbox",
  schema: setupSandboxPayloadSchema,
  maxDuration: 60 * 5, // 5 minutes max
  retry: {
    maxAttempts: 0, // No retries — run once
  },
  run: async (payload) => {
    const { sandboxId, accountId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logger.log("Starting sandbox setup", { sandboxId, accountId });

    const sandbox = await Sandbox.get({ sandboxId, token, teamId, projectId });

    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

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
  },
});

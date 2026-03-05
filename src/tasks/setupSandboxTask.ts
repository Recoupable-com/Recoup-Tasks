import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { createAccountSandbox } from "../recoup/createAccountSandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { provisionSandbox } from "../sandboxes/provisionSandbox";
import { setupSandboxPayloadSchema } from "../schemas/setupSandboxSchema";

/**
 * Background task that creates a personal Vercel Sandbox for an account,
 * fully provisions it (OpenClaw, GitHub repo, org repos, folder structure),
 * takes a snapshot, and shuts it down.
 */
export const setupSandboxTask = schemaTask({
  id: "setup-sandbox",
  schema: setupSandboxPayloadSchema,
  maxDuration: 60 * 15, // 15 minutes max to accommodate OpenClaw install
  retry: {
    maxAttempts: 0, // Zero retries — run once only
  },
  run: async (payload) => {
    const { accountId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logger.log("Starting sandbox setup", { accountId });

    metadata.set("currentStep", "Creating sandbox");
    metadata.append("logs", "Creating sandbox");

    const created = await createAccountSandbox(accountId);
    if (!created) {
      metadata.set("currentStep", "Failed");
      metadata.append("logs", "Failed to create sandbox");
      throw new Error(`Failed to create sandbox for account ${accountId}`);
    }

    const { sandboxId } = created;
    logger.log("Sandbox created via API", { sandboxId });
    metadata.append("logs", `Sandbox created: ${sandboxId}`);

    const sandbox = await Sandbox.get({ sandboxId, token, teamId, projectId });

    metadata.set("currentStep", "Connected to sandbox");
    metadata.append("logs", "Connected to sandbox");
    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    try {
      metadata.set("currentStep", "Provisioning sandbox");
      metadata.append("logs", "Provisioning sandbox");
      const { githubRepo } = await provisionSandbox(sandbox, sandboxId, accountId);
      metadata.append("logs", "Provisioning complete");

      metadata.set("currentStep", "Taking snapshot");
      metadata.append("logs", "Taking snapshot");
      const snapshotResult = await snapshotAndPersist(
        sandbox,
        accountId,
        githubRepo,
      );

      metadata.set("currentStep", "Complete");
      metadata.append("logs", "Sandbox setup complete");
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

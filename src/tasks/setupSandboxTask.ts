import { schemaTask } from "@trigger.dev/sdk/v3";
import { getOrCreateSandbox } from "../sandboxes/getOrCreateSandbox";
import { logStep } from "../sandboxes/logStep";
import { pushSandboxToGithub } from "../sandboxes/pushSandboxToGithub";
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

    logStep("Starting sandbox setup", true, { accountId });

    const { sandboxId, sandbox } = await getOrCreateSandbox(accountId);

    try {
      logStep("Provisioning sandbox");
      const { githubRepo } = await provisionSandbox(sandbox, sandboxId, accountId);
      logStep("Provisioning complete", false);

      logStep("Pushing to GitHub");
      await pushSandboxToGithub(sandbox);

      logStep("Taking snapshot");
      const snapshotResult = await snapshotAndPersist(
        sandbox,
        accountId,
        githubRepo,
      );

      logStep("Sandbox setup complete", true, {
        sandboxId: sandbox.sandboxId,
        githubRepo: githubRepo ?? null,
        snapshotId: snapshotResult.snapshotId,
      });

      return {
        githubRepo: githubRepo ?? null,
        snapshotId: snapshotResult.snapshotId,
      };
    } finally {
      logStep("Stopping sandbox", false, { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

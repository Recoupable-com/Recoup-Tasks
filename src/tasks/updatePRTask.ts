import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { installOpenClaw } from "../sandboxes/installOpenClaw";
import { setupOpenClaw } from "../sandboxes/setupOpenClaw";
import { runOpenClawAgent } from "../sandboxes/runOpenClawAgent";
import { runGitCommand } from "../sandboxes/runGitCommand";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { updatePRPayloadSchema } from "../schemas/updatePRSchema";

const MONOREPO_DIR = "/home/user/monorepo";
const CODING_AGENT_ACCOUNT_ID = "coding-agent";

/**
 * Background task that resumes a sandbox from a snapshot, applies feedback
 * via the AI agent, and pushes updates to existing PR branches.
 */
export const updatePRTask = schemaTask({
  id: "update-pr",
  schema: updatePRPayloadSchema,
  maxDuration: 60 * 15,
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    const { feedback, snapshotId, branch, prs, callbackThreadId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logStep("Resuming sandbox from snapshot");

    const sandbox = await Sandbox.create({
      token,
      teamId,
      projectId,
      source: { type: "snapshot", snapshotId },
      timeoutMs: 30 * 60 * 1000,
    });

    logger.log("Sandbox resumed", { sandboxId: sandbox.sandboxId, snapshotId });

    try {
      logStep("Ensuring OpenClaw is running");
      await installOpenClaw(sandbox);
      await setupOpenClaw(sandbox, CODING_AGENT_ACCOUNT_ID);

      logStep("Running AI agent with feedback");
      await runOpenClawAgent(sandbox, {
        label: "Apply feedback",
        message: `The following feedback was given on the existing changes on branch "${branch}":\n\n${feedback}\n\nPlease make the requested changes.`,
      });

      logStep("Pushing updates to PR branches");
      for (const pr of prs) {
        const submodule = pr.repo.split("/").pop()!;
        // Remap repo name to submodule dir name
        const subDir = submodule === "recoup-api" ? "api" : submodule;
        const fullDir = `${MONOREPO_DIR}/${subDir}`;

        await runGitCommand(sandbox, ["-C", fullDir, "add", "-A"], "stage changes", fullDir);
        await runGitCommand(
          sandbox,
          ["-C", fullDir, "commit", "-m", `agent: address feedback\n\n${feedback.slice(0, 200)}`],
          "commit feedback",
          fullDir,
        );
        await runGitCommand(
          sandbox,
          ["-C", fullDir, "push", "origin", branch],
          "push updates",
          fullDir,
        );
      }

      logStep("Taking new snapshot");
      const newSnapshot = await sandbox.snapshot();

      logStep("Notifying bot");
      await notifyCodingAgentCallback({
        threadId: callbackThreadId,
        status: "updated",
        snapshotId: newSnapshot.snapshotId,
      });

      metadata.set("currentStep", "Complete");

      return { snapshotId: newSnapshot.snapshotId };
    } finally {
      logger.log("Stopping sandbox", { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

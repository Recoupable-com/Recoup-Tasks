import { metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { installOpenClaw } from "../sandboxes/installOpenClaw";
import { setupOpenClaw } from "../sandboxes/setupOpenClaw";
import { runClaudeCodeAgent } from "../sandboxes/runClaudeCodeAgent";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { configureGitAuth } from "../sandboxes/configureGitAuth";
import { getSandboxEnv } from "../sandboxes/getSandboxEnv";
import { updatePRPayloadSchema } from "../schemas/updatePRSchema";
import { CODING_AGENT_ACCOUNT_ID } from "../consts";

/**
 * Background task that resumes a sandbox from a snapshot, applies feedback
 * via the AI agent, and delegates push of updates to the agent.
 */
export const updatePRTask = schemaTask({
  id: "update-pr",
  schema: updatePRPayloadSchema,
  maxDuration: 60 * 15,
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    const { feedback, snapshotId, branch, repo, callbackThreadId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logStep("Resuming sandbox from snapshot");

    const sandbox = await Sandbox.create({
      token,
      teamId,
      projectId,
      source: { type: "snapshot", snapshotId },
      timeout: 30 * 60 * 1000,
    });

    logStep("Sandbox resumed", false, { sandboxId: sandbox.sandboxId, snapshotId });

    try {
      logStep("Ensuring OpenClaw is running");
      await installOpenClaw(sandbox);
      await setupOpenClaw(sandbox, CODING_AGENT_ACCOUNT_ID);
      await configureGitAuth(sandbox);

      const env = getSandboxEnv(CODING_AGENT_ACCOUNT_ID);

      logStep("Running AI agent with feedback");
      const agentResult = await runClaudeCodeAgent(sandbox, {
        label: "Apply feedback",
        message: `The following feedback was given on the existing changes on branch "${branch}":\n\n${feedback}\n\nPlease make the requested changes.`,
        env,
      });

      logStep("Pushing updates via agent");
      await runClaudeCodeAgent(sandbox, {
        label: "Push feedback changes",
        env,
        message: [
          `Stage, commit, and push the feedback changes to the existing PR branch.`,
          ``,
          `Repo: ${repo}, branch: ${branch}`,
          ``,
          `Steps:`,
          `1. cd into the submodule directory for ${repo}`,
          `2. git add -A`,
          `3. git commit -m "agent: address feedback"`,
          `4. git push origin ${branch}`,
        ].join("\n"),
      });

      logStep("Taking new snapshot");
      const newSnapshot = await sandbox.snapshot();

      const callbackPayload = {
        threadId: callbackThreadId,
        status: "updated" as const,
        snapshotId: newSnapshot.snapshotId,
        stdout: agentResult.stdout,
        stderr: agentResult.stderr,
      };
      logStep("Notifying bot", true, callbackPayload);
      await notifyCodingAgentCallback(callbackPayload);

      metadata.set("currentStep", "Complete");

      return { snapshotId: newSnapshot.snapshotId };
    } finally {
      logStep("Stopping sandbox", false, { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

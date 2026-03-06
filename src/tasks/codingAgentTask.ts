import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { installOpenClaw } from "../sandboxes/installOpenClaw";
import { setupOpenClaw } from "../sandboxes/setupOpenClaw";
import { cloneMonorepoViaAgent } from "../sandboxes/cloneMonorepoViaAgent";
import { runOpenClawAgent } from "../sandboxes/runOpenClawAgent";
import { pushAndCreatePRsViaAgent } from "../sandboxes/pushAndCreatePRsViaAgent";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { getSandboxEnv } from "../sandboxes/getSandboxEnv";
import { configureGitAuth } from "../sandboxes/configureGitAuth";
import { codingAgentPayloadSchema } from "../schemas/codingAgentSchema";

const CODING_AGENT_ACCOUNT_ID = "coding-agent";

/**
 * Background task that spins up a sandbox, clones the Recoup monorepo
 * via the AI agent, runs it to make changes, and delegates PR creation
 * to the agent as well.
 */
export const codingAgentTask = schemaTask({
  id: "coding-agent",
  schema: codingAgentPayloadSchema,
  maxDuration: 60 * 15,
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    const { prompt, callbackThreadId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logStep("Creating sandbox");

    const sandbox = await Sandbox.create({
      token,
      teamId,
      projectId,
      timeoutMs: 30 * 60 * 1000,
    });

    logger.log("Sandbox created", { sandboxId: sandbox.sandboxId });

    try {
      logStep("Installing OpenClaw");
      await installOpenClaw(sandbox);
      await setupOpenClaw(sandbox, CODING_AGENT_ACCOUNT_ID);
      await configureGitAuth(sandbox);

      const env = getSandboxEnv(CODING_AGENT_ACCOUNT_ID);

      logStep("Cloning monorepo via agent");
      await cloneMonorepoViaAgent(sandbox, env);

      logStep("Running AI agent");
      const agentResult = await runOpenClawAgent(sandbox, {
        label: "Coding agent",
        message: prompt,
        env,
      });

      logStep("Agent completed", true, {
        exitCode: agentResult.exitCode,
        stdout: agentResult.stdout.slice(-2000),
        stderr: agentResult.stderr.slice(-2000),
      });

      logStep("Creating PRs via agent");
      const timestamp = Date.now();
      const slug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const branch = `agent/${slug}-${timestamp}`;

      const prs = await pushAndCreatePRsViaAgent(sandbox, { prompt, branch, env });

      logStep("Taking snapshot");
      const { snapshotId } = await sandbox.snapshot();

      logStep("Notifying bot");
      await notifyCodingAgentCallback({
        threadId: callbackThreadId,
        status: prs.length > 0 ? "pr_created" : "no_changes",
        branch,
        snapshotId,
        prs,
        stdout: agentResult.stdout,
        stderr: agentResult.stderr,
      });

      metadata.set("currentStep", "Complete");

      return { branch, snapshotId, prs, stdout: agentResult.stdout, stderr: agentResult.stderr };
    } finally {
      logger.log("Stopping sandbox", { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

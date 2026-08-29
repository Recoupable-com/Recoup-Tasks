import { metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { cloneMonorepoViaAgent } from "../sandboxes/cloneMonorepoViaAgent";
import { runClaudeCodeAgent } from "../sandboxes/runClaudeCodeAgent";
import { pushAndCreatePRsViaAgent } from "../sandboxes/pushAndCreatePRsViaAgent";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { configureGitAuth } from "../sandboxes/configureGitAuth";
import { codingAgentPayloadSchema } from "../schemas/codingAgentSchema";
import { getOrCreateSandbox } from "../sandboxes/getOrCreateSandbox";
import { syncMonorepoSubmodules } from "../sandboxes/git/syncMonorepoSubmodules";
import { CODING_AGENT_ACCOUNT_ID } from "../consts";

/**
 * Background task that spins up a sandbox, clones the Recoup monorepo
 * via the AI agent, runs it to make changes, and delegates PR creation
 * to the agent as well.
 */
export const codingAgentTask = schemaTask({
  id: "coding-agent",
  schema: codingAgentPayloadSchema,
  maxDuration: 60 * 30,
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    const { prompt, callbackThreadId } = payload;

    const { sandboxId, sandbox } = await getOrCreateSandbox(CODING_AGENT_ACCOUNT_ID);

    logStep("Sandbox created", false, { sandboxId });

    try {
      await configureGitAuth(sandbox);

      logStep("Cloning monorepo via agent");
      await cloneMonorepoViaAgent(sandbox);

      logStep("Syncing submodules to latest base branches");
      await syncMonorepoSubmodules(sandbox);

      logStep("Running AI agent");
      const agentResult = await runClaudeCodeAgent(sandbox, {
        label: "Coding agent",
        message: prompt,
      });

      logStep("Agent completed", true, {
        exitCode: agentResult.exitCode,
        stdout: agentResult.stdout.slice(-2000),
        stderr: agentResult.stderr.slice(-2000),
      });

      logStep("Creating PRs via agent", true, {
        agentStdoutLength: agentResult.stdout.length,
        agentStdoutTail: agentResult.stdout.slice(-500),
      });
      const timestamp = Date.now();
      const slug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const branch = `agent/${slug}-${timestamp}`;

      const prs = await pushAndCreatePRsViaAgent(sandbox, { prompt, branch, agentStdout: agentResult.stdout });

      logStep("Taking snapshot");
      const { snapshotId } = await sandbox.snapshot();

      if (callbackThreadId) {
        const callbackPayload = {
          threadId: callbackThreadId,
          status: (prs.length > 0 ? "pr_created" : "no_changes") as "pr_created" | "no_changes",
          branch,
          snapshotId,
          prs,
          stdout: agentResult.stdout,
          stderr: agentResult.stderr,
        };
        logStep("Notifying bot", true, callbackPayload);
        await notifyCodingAgentCallback(callbackPayload);
      }

      metadata.set("currentStep", "Complete");

      return { branch, snapshotId, prs, stdout: agentResult.stdout, stderr: agentResult.stderr };
    } finally {
      logStep("Stopping sandbox", false, { sandboxId: sandbox.name });
      await sandbox.stop();
    }
  },
});

import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { installOpenClaw } from "../sandboxes/installOpenClaw";
import { setupOpenClaw } from "../sandboxes/setupOpenClaw";
import { cloneRecoupMonorepo } from "../sandboxes/cloneRecoupMonorepo";
import { runOpenClawAgent } from "../sandboxes/runOpenClawAgent";
import { detectChangedSubmodules } from "../sandboxes/detectChangedSubmodules";
import { createSubmodulePR } from "../sandboxes/createSubmodulePR";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { codingAgentPayloadSchema } from "../schemas/codingAgentSchema";

const MONOREPO_DIR = "/home/user/monorepo";
const CODING_AGENT_ACCOUNT_ID = "coding-agent";

/**
 * Background task that spins up a sandbox, clones the Recoup monorepo,
 * runs an AI agent to make changes, and opens PRs for each modified submodule.
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

      logStep("Installing gh CLI");
      await sandbox.runCommand({ cmd: "sh", args: ["-c", "which gh || (apt-get update -qq && apt-get install -y -qq gh)"], sudo: true });

      logStep("Cloning monorepo");
      const cloned = await cloneRecoupMonorepo(sandbox);
      if (!cloned) {
        await notifyCodingAgentCallback({
          threadId: callbackThreadId,
          status: "failed",
          message: "Failed to clone monorepo",
        });
        return;
      }

      logStep("Running AI agent");
      const agentResult = await runOpenClawAgent(sandbox, {
        label: "Coding agent",
        message: prompt,
      });

      logStep("Detecting changes");
      const changedSubmodules = await detectChangedSubmodules(sandbox, MONOREPO_DIR);

      if (changedSubmodules.length === 0) {
        await notifyCodingAgentCallback({
          threadId: callbackThreadId,
          status: "no_changes",
          message: "No files were modified",
          stdout: agentResult.stdout,
          stderr: agentResult.stderr,
        });
        return;
      }

      logStep("Creating PRs");
      const timestamp = Date.now();
      const slug = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const branch = `agent/${slug}-${timestamp}`;

      const prs = [];
      for (const submodule of changedSubmodules) {
        const pr = await createSubmodulePR(sandbox, {
          submodule,
          branch,
          prompt,
          monorepoDir: MONOREPO_DIR,
        });
        if (pr) {
          prs.push(pr);
        }
      }

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

import { metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { runClaudeCodeAgent } from "../sandboxes/runClaudeCodeAgent";
import { notifyCodingAgentCallback } from "../sandboxes/notifyCodingAgentCallback";
import { logStep } from "../sandboxes/logStep";
import { configureGitAuth } from "../sandboxes/configureGitAuth";
import { getSandboxEnv } from "../sandboxes/getSandboxEnv";
import { updatePRPayloadSchema } from "../schemas/updatePRSchema";
import { CODING_AGENT_ACCOUNT_ID } from "../consts";
import { PROGRESS_PROMPT_PREFIX, PROGRESS_PROMPT_SUFFIX } from "./promptPrefixes";

/**
 * Background task that resumes a named sandbox, applies feedback
 * via the Claude Code agent, and pushes the updates to the existing PR branch.
 */
export const updatePRTask = schemaTask({
  id: "update-pr",
  schema: updatePRPayloadSchema,
  maxDuration: 60 * 15,
  retry: {
    maxAttempts: 0,
  },
  run: async (payload) => {
    const { feedback, branch, repo, callbackThreadId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logStep("Resuming sandbox by name");

    const sandbox = await Sandbox.get({
      name: CODING_AGENT_ACCOUNT_ID,
      token,
      teamId,
      projectId,
    });

    logStep("Sandbox resumed", false, { sandboxId: sandbox.name });

    try {
      await configureGitAuth(sandbox);

      const env = getSandboxEnv(CODING_AGENT_ACCOUNT_ID);

      logStep("Running AI agent with feedback");
      const agentResult = await runClaudeCodeAgent(sandbox, {
        label: "Apply feedback",
        message: `${PROGRESS_PROMPT_PREFIX} apply the following feedback given on the existing changes on branch "${branch}":\n\n${feedback}\n\nPlease make the requested changes.\n\n${PROGRESS_PROMPT_SUFFIX}`,
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

      const callbackPayload = {
        threadId: callbackThreadId,
        status: "updated" as const,
        stdout: agentResult.stdout,
        stderr: agentResult.stderr,
      };
      logStep("Notifying bot", true, callbackPayload);
      await notifyCodingAgentCallback(callbackPayload);

      metadata.set("currentStep", "Complete");
    } finally {
      logStep("Stopping sandbox", false, { sandboxId: sandbox.name });
      await sandbox.stop();
    }
  },
});

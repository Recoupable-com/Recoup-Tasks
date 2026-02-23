import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";
import { Sandbox } from "@vercel/sandbox";
import { installOpenClaw } from "../sandboxes/installOpenClaw";
import { setupOpenClaw } from "../sandboxes/setupOpenClaw";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { writeReadme } from "../sandboxes/writeReadme";
import { ensureOrgRepos } from "../sandboxes/ensureOrgRepos";
import { ensureSetupSandbox } from "../sandboxes/ensureSetupSandbox";
import { pushSandboxToGithub } from "../sandboxes/pushSandboxToGithub";
import {
  runSandboxCommandPayloadSchema,
  type SandboxResult,
} from "../schemas/sandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox, ensures OpenClaw
 * is installed with AI Gateway, runs a command with arguments, captures
 * output, takes a snapshot, and updates the account's snapshot ID.
 */
export const runSandboxCommandTask = schemaTask({
  id: "run-sandbox-command",
  schema: runSandboxCommandPayloadSchema,
  maxDuration: 60 * 15, // 15 minutes max for sandbox execution
  retry: {
    maxAttempts: 1, // No retries - sandbox operations are not idempotent
  },
  run: async (payload): Promise<SandboxResult> => {
    const { command, args, cwd, sandboxId, accountId } = payload;
    const { token, teamId, projectId } = getVercelSandboxCredentials();

    logger.log("Starting sandbox command execution", {
      sandboxId,
      command,
      args,
      cwd,
      accountId,
    });

    const sandbox = await Sandbox.get({ sandboxId, token, teamId, projectId });

    logStep("Connected to sandbox");

    try {
      // Ensure OpenClaw is installed and configured with AI Gateway
      await installOpenClaw(sandbox);
      await setupOpenClaw(sandbox, accountId);
      logStep("OpenClaw onboard complete, starting gateway");

      // Ensure GitHub repo exists and is cloned in sandbox
      const githubRepo = await ensureGithubRepo(sandbox, accountId);
      logStep("GitHub repo ready");

      // Write README.md with sandbox details
      await writeReadme(sandbox, sandboxId, accountId, githubRepo ?? undefined);
      logStep("README written", false);

      // Ensure org GitHub repos exist and are cloned in workspace
      await ensureOrgRepos(sandbox, accountId);

      // Ensure org/artist folder structure exists (setup via OpenClaw)
      await ensureSetupSandbox(sandbox, accountId);

      // Run the command with args
      logStep("Running command");

      const commandResult = await sandbox.runCommand({
        cmd: command,
        args: args || [],
        cwd,
        env: {
          RECOUP_API_KEY: process.env.RECOUP_API_KEY!,
          RECOUP_ACCOUNT_ID: accountId,
        },
      });

      const stdout = (await commandResult.stdout()) || "";
      const stderr = (await commandResult.stderr()) || "";
      const exitCode = commandResult.exitCode;

      logStep("Command execution completed", false);

      // Push sandbox files to GitHub repo
      logStep("Pushing to GitHub");
      await pushSandboxToGithub(sandbox);

      const snapshotResult = await snapshotAndPersist(
        sandbox,
        accountId,
        githubRepo ?? undefined
      );

      const result: SandboxResult = {
        stdout,
        stderr,
        exitCode,
        snapshot: {
          id: snapshotResult.snapshotId,
          expiresAt: snapshotResult.expiresAt.toISOString(),
        },
      };

      logStep("Sandbox command completed successfully");

      return result;
    } catch (error) {
      logStep("Failed");
      logger.error("Sandbox command failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

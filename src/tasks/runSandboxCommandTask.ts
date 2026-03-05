import { logger, schemaTask, tags } from "@trigger.dev/sdk/v3";
import { logStep } from "../sandboxes/logStep";
import { Sandbox } from "@vercel/sandbox";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { provisionSandbox } from "../sandboxes/provisionSandbox";
import { pushSandboxToGithub } from "../sandboxes/pushSandboxToGithub";
import {
  runSandboxCommandPayloadSchema,
  type SandboxResult,
} from "../schemas/sandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox, ensures it is
 * fully provisioned, runs a command with arguments, captures output, takes a
 * snapshot, and updates the account's snapshot ID.
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
    await tags.add(`account:${accountId}`);
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
      // Provision sandbox with full Recoup environment
      const { githubRepo } = await provisionSandbox(sandbox, sandboxId, accountId);

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
        githubRepo,
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

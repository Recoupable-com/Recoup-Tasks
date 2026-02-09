import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { installOpenCode } from "../sandboxes/installOpenCode";
import { writeOpenCodeConfig } from "../sandboxes/writeOpenCodeConfig";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { writeReadme } from "../sandboxes/writeReadme";
import { pushSandboxToGithub } from "../sandboxes/pushSandboxToGithub";
import { updateAccountSnapshot } from "../recoup/updateAccountSnapshot";
import {
  runSandboxCommandPayloadSchema,
  type SandboxResult,
} from "../schemas/sandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox, ensures OpenCode
 * is installed with Vercel AI Gateway, runs a command with arguments, captures
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

    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    try {
      // Ensure OpenCode is installed and configured with Vercel AI Gateway
      await installOpenCode(sandbox);
      await writeOpenCodeConfig(sandbox);

      // Ensure GitHub repo exists and is cloned in sandbox
      const githubRepo = await ensureGithubRepo(sandbox, accountId);

      // Write README.md with sandbox details
      await writeReadme(sandbox, sandboxId, accountId, githubRepo ?? undefined);

      // Run the command with args
      logger.log("Running command", { command, args, cwd });

      const commandResult = await sandbox.runCommand({
        cmd: command,
        args: args || [],
        cwd,
      });

      const stdout = (await commandResult.stdout()) || "";
      const stderr = (await commandResult.stderr()) || "";
      const exitCode = commandResult.exitCode;

      logger.log("Command execution completed", {
        exitCode,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      // Push sandbox files to GitHub repo
      await pushSandboxToGithub(sandbox);

      // Take a snapshot
      logger.log("Taking sandbox snapshot");
      const snapshotResult = await sandbox.snapshot();

      logger.log("Snapshot created", {
        snapshotId: snapshotResult.snapshotId,
        expiresAt: snapshotResult.expiresAt,
      });

      // Update account snapshot (and github_repo if newly created) via API
      await updateAccountSnapshot(accountId, snapshotResult.snapshotId, githubRepo ?? undefined);

      const result: SandboxResult = {
        stdout,
        stderr,
        exitCode,
        snapshot: {
          id: snapshotResult.snapshotId,
          expiresAt: snapshotResult.expiresAt.toISOString(),
        },
      };

      logger.log("Sandbox command completed successfully", {
        sandboxId: sandbox.sandboxId,
        snapshotId: snapshotResult.snapshotId,
      });

      return result;
    } catch (error) {
      logger.error("Sandbox command failed", {
        sandboxId: sandbox.sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

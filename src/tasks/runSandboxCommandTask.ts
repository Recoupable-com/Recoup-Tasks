import { logger, metadata, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { installOpenCode } from "../sandboxes/installOpenCode";
import { writeOpenCodeConfig } from "../sandboxes/writeOpenCodeConfig";
import { ensureGithubRepo } from "../sandboxes/ensureGithubRepo";
import { getVercelSandboxCredentials } from "../sandboxes/getVercelSandboxCredentials";
import { snapshotAndPersist } from "../sandboxes/snapshotAndPersist";
import { writeReadme } from "../sandboxes/writeReadme";
import { ensureSetupSandbox } from "../sandboxes/ensureSetupSandbox";
import { pushSandboxToGithub } from "../sandboxes/pushSandboxToGithub";
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

    metadata.set("currentStep", "Connected to sandbox");
    metadata.append("logs", "Connected to sandbox");
    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    try {
      // Ensure OpenCode is installed and configured with Vercel AI Gateway
      await installOpenCode(sandbox);
      await writeOpenCodeConfig(sandbox);
      metadata.set("currentStep", "OpenCode configured");
      metadata.append("logs", "OpenCode installed and configured");

      // Ensure GitHub repo exists and is cloned in sandbox
      const githubRepo = await ensureGithubRepo(sandbox, accountId);
      metadata.set("currentStep", "GitHub repo ready");
      metadata.append("logs", "GitHub repo ready");

      // Write README.md with sandbox details
      await writeReadme(sandbox, sandboxId, accountId, githubRepo ?? undefined);
      metadata.append("logs", "README written");

      // Ensure org/artist folder structure exists (setup via OpenCode)
      metadata.set("currentStep", "Setting up sandbox folders");
      metadata.append("logs", "Checking sandbox setup");
      await ensureSetupSandbox(sandbox, accountId);
      metadata.append("logs", "Sandbox folders ready");

      // Run the command with args
      metadata.set("currentStep", "Running command");
      metadata.append("logs", `Running command: ${command}`);
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
      metadata.append("logs", `Command finished with exit code ${exitCode}`);

      // Push sandbox files to GitHub repo
      metadata.set("currentStep", "Pushing to GitHub");
      metadata.append("logs", "Pushing to GitHub");
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

      metadata.set("currentStep", "Complete");
      metadata.append("logs", "Sandbox command completed successfully");
      logger.log("Sandbox command completed successfully", {
        sandboxId: sandbox.sandboxId,
        snapshotId: snapshotResult.snapshotId,
      });

      return result;
    } catch (error) {
      metadata.set("currentStep", "Failed");
      metadata.append(
        "logs",
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      logger.error("Sandbox command failed", {
        sandboxId: sandbox.sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

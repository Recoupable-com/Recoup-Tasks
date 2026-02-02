import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import { installClaudeCode } from "../sandboxes/installClaudeCode";
import { runClaudeCode } from "../sandboxes/runClaudeCode";
import {
  runSandboxCommandPayloadSchema,
  type SandboxResult,
} from "../schemas/sandboxSchema";

/**
 * Background task that connects to an existing Vercel Sandbox, installs Claude Code,
 * and executes a prompt. The sandbox is created by the API which returns immediately,
 * while this task runs the actual work asynchronously.
 */
export const runSandboxCommandTask = schemaTask({
  id: "run-sandbox-command",
  schema: runSandboxCommandPayloadSchema,
  maxDuration: 60 * 15, // 15 minutes max for sandbox execution
  retry: {
    maxAttempts: 1, // No retries - sandbox operations are not idempotent
  },
  run: async (payload): Promise<SandboxResult> => {
    const { prompt, sandboxId } = payload;

    logger.log("Starting sandbox command execution", {
      sandboxId,
      promptLength: prompt.length,
    });

    const sandbox = await Sandbox.get({ sandboxId });

    logger.log("Connected to sandbox", {
      sandboxId: sandbox.sandboxId,
      status: sandbox.status,
    });

    try {
      await installClaudeCode(sandbox);
      await runClaudeCode(sandbox, prompt);

      const result: SandboxResult = {
        sandboxId: sandbox.sandboxId,
        sandboxStatus: sandbox.status,
        timeout: sandbox.timeout,
        createdAt: sandbox.createdAt.toISOString(),
      };

      logger.log("Sandbox command completed successfully", {
        sandboxId: sandbox.sandboxId,
      });

      return result;
    } catch (error) {
      logger.error("Sandbox command failed", {
        sandboxId: sandbox.sandboxId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      logger.log("Stopping sandbox", { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

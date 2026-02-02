import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { Sandbox } from "@vercel/sandbox";
import ms from "ms";
import { installClaudeCode } from "../sandbox/installClaudeCode";
import { runClaudeCode } from "../sandbox/runClaudeCode";
import {
  runSandboxCommandPayloadSchema,
  type SandboxResult,
} from "../schemas/sandboxSchema";

/**
 * Background task that creates a Vercel Sandbox, installs Claude Code,
 * and executes a prompt. This allows the API to respond quickly while
 * the sandbox execution runs asynchronously.
 */
export const runSandboxCommandTask = schemaTask({
  id: "run-sandbox-command",
  schema: runSandboxCommandPayloadSchema,
  maxDuration: 60 * 15, // 15 minutes max for sandbox execution
  retry: {
    maxAttempts: 1, // No retries - sandbox operations are not idempotent
  },
  run: async (payload): Promise<SandboxResult> => {
    const { prompt, accountId } = payload;

    logger.log("Starting sandbox command execution", {
      accountId,
      promptLength: prompt.length,
    });

    const sandbox = await Sandbox.create({
      resources: { vcpus: 4 },
      timeout: ms("10m"),
      runtime: "node22",
    });

    logger.log("Sandbox created", {
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
        accountId,
      });

      return result;
    } catch (error) {
      logger.error("Sandbox command failed", {
        sandboxId: sandbox.sandboxId,
        accountId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      logger.log("Stopping sandbox", { sandboxId: sandbox.sandboxId });
      await sandbox.stop();
    }
  },
});

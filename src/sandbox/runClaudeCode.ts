import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Executes a Claude Code prompt in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param prompt - The prompt to send to Claude
 */
export async function runClaudeCode(
  sandbox: Sandbox,
  prompt: string
): Promise<void> {
  const escapedPrompt = prompt.replace(/'/g, "'\\''");
  const script = `claude --permission-mode acceptEdits --model opus '${escapedPrompt}'`;

  logger.log("Writing Claude Code script to sandbox");

  await sandbox.writeFiles([
    {
      path: "/vercel/sandbox/ralph-once.sh",
      content: Buffer.from(script),
    },
  ]);

  logger.log("Executing Claude Code prompt", {
    promptLength: prompt.length,
  });

  const result = await sandbox.runCommand({
    cmd: "sh",
    args: ["ralph-once.sh"],
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
    },
  });

  logger.log("Claude Code execution completed", {
    exitCode: result.exitCode,
  });
}

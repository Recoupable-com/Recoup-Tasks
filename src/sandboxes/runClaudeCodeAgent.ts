import type { Sandbox } from "@vercel/sandbox";
import { logStep } from "./logStep";

interface RunClaudeCodeAgentOptions {
  label: string;
  message: string;
  env?: Record<string, string>;
}

interface RunClaudeCodeAgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs a Claude Code agent command with standardized logging and metadata.
 * Uses the `claude` CLI with --print flag for non-interactive execution.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param options - Label for logging/metadata, message prompt, optional env vars
 * @returns exitCode, stdout, and stderr from the command
 */
export async function runClaudeCodeAgent(
  sandbox: Sandbox,
  options: RunClaudeCodeAgentOptions,
): Promise<RunClaudeCodeAgentResult> {
  const { label, message, env } = options;

  const args = ["-p", "--dangerously-skip-permissions", message];

  logStep(label, true, { cmd: "claude", args });

  const commandOpts: Record<string, unknown> = {
    cmd: "claude",
    args,
    cwd: "/vercel/sandbox/mono",
    detached: true,
    env: {
      ...env,
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
    },
  };

  const command = await sandbox.runCommand(commandOpts as any);
  const result = await command.wait();

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logStep(`${label} completed`, false, {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    logStep(`${label} failed`, false, { stderr });
  }

  return {
    exitCode: result.exitCode,
    stdout,
    stderr,
  };
}

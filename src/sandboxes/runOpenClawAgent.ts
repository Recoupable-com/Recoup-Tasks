import type { Sandbox } from "@vercel/sandbox";
import { logStep } from "./logStep";

interface RunOpenClawAgentOptions {
  label: string;
  message: string;
  env?: Record<string, string>;
}

interface RunOpenClawAgentResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs an OpenClaw agent command with standardized logging and metadata.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param options - Label for logging/metadata, message prompt, optional env vars
 * @returns exitCode, stdout, and stderr from the command
 */
export async function runOpenClawAgent(
  sandbox: Sandbox,
  options: RunOpenClawAgentOptions,
): Promise<RunOpenClawAgentResult> {
  const { label, message, env } = options;

  const args = ["agent", "--agent", "main", "--message", message];

  logStep(label, true, { cmd: "openclaw", args });

  const commandOpts: Record<string, unknown> = {
    cmd: "openclaw",
    args,
    detached: true,
  };

  if (env) {
    commandOpts.env = env;
  }

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

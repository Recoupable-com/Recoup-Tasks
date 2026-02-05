import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Runs a git command in the sandbox and logs stderr on failure.
 *
 * @returns true if the command succeeded, false otherwise
 */
export async function runGitCommand(
  sandbox: Sandbox,
  args: string[],
  description: string
): Promise<boolean> {
  const result = await sandbox.runCommand({ cmd: "git", args });

  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()) || "";
    const stdout = (await result.stdout()) || "";
    logger.error(`Failed to ${description}`, {
      exitCode: result.exitCode,
      stderr,
      stdout,
    });
    return false;
  }

  return true;
}

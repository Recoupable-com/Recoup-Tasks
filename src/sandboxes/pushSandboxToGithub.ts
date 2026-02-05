import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Runs a git command in the sandbox and logs stderr on failure.
 *
 * @returns true if the command succeeded, false otherwise
 */
async function runGitCommand(
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

/**
 * Commits and pushes all local sandbox files to the GitHub repository.
 *
 * Configures git user, stages all files, commits, and pushes to origin main.
 * Skips the push if there are no changes to commit.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @returns true if push succeeded or there were no changes, false on error
 */
export async function pushSandboxToGithub(
  sandbox: Sandbox
): Promise<boolean> {
  logger.log("Pushing sandbox files to GitHub");

  // Configure git user for commits
  if (
    !(await runGitCommand(
      sandbox,
      ["config", "user.email", "agent@recoupable.com"],
      "configure git email"
    ))
  ) {
    return false;
  }

  if (
    !(await runGitCommand(
      sandbox,
      ["config", "user.name", "Recoup Agent"],
      "configure git name"
    ))
  ) {
    return false;
  }

  // Stage all files
  if (!(await runGitCommand(sandbox, ["add", "-A"], "stage files"))) {
    return false;
  }

  // Check if there are changes to commit
  const diffResult = await sandbox.runCommand({
    cmd: "git",
    args: ["diff", "--cached", "--quiet"],
  });

  if (diffResult.exitCode === 0) {
    logger.log("No changes to commit, skipping push");
    return true;
  }

  // Commit changes
  if (
    !(await runGitCommand(
      sandbox,
      ["commit", "-m", "Update sandbox files"],
      "commit changes"
    ))
  ) {
    return false;
  }

  // Push to remote
  if (
    !(await runGitCommand(
      sandbox,
      ["push", "origin", "main"],
      "push to remote"
    ))
  ) {
    return false;
  }

  logger.log("Sandbox files pushed to GitHub successfully");
  return true;
}

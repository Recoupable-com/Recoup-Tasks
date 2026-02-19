import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runGitCommand } from "./runGitCommand";

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

  // Copy ~/.openclaw into the repo and remove any nested .git dirs
  // so they don't conflict with the sandbox's own git repo.
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "cp -r ~/.openclaw /vercel/sandbox/.openclaw && find /vercel/sandbox/.openclaw -name .git -type d -exec rm -rf {} + 2>/dev/null || true"],
  });

  // Stage all files
  if (!(await runGitCommand(sandbox, ["add", "-A"], "stage files"))) {
    return false;
  }

  // Check if there are changes to commit
  const diffResult = await sandbox.runCommand({
    cmd: "git",
    args: ["diff", "--cached", "--quiet"],
  });

  if (diffResult.exitCode !== 0) {
    // There are staged changes — commit them
    if (
      !(await runGitCommand(
        sandbox,
        ["commit", "-m", "Update sandbox files"],
        "commit changes"
      ))
    ) {
      return false;
    }
  }

  // Clean up any stale rebase state from previous failed runs
  await sandbox.runCommand({ cmd: "git", args: ["rebase", "--abort"] });

  // Force push — sandbox files are the source of truth
  if (
    !(await runGitCommand(
      sandbox,
      ["push", "--force", "origin", "HEAD:main"],
      "push to remote"
    ))
  ) {
    return false;
  }

  logger.log("Sandbox files pushed to GitHub successfully");
  return true;
}

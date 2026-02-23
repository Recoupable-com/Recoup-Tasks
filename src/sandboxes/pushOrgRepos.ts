import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

const WORKSPACE_ORGS = "~/.openclaw/workspace/orgs";

/**
 * Commits and pushes changes inside each org repo found in the
 * OpenClaw workspace before the parent account repo is pushed.
 *
 * Scans `~/.openclaw/workspace/orgs/` for directories containing
 * a `.git` directory. Skips repos with no changes.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function pushOrgRepos(sandbox: Sandbox): Promise<void> {
  // Find org directories that are git repos
  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${WORKSPACE_ORGS} -mindepth 1 -maxdepth 1 -type d -exec test -d {}/.git \\; -print 2>/dev/null | xargs -I{} basename {}`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) {
    logger.log("No org repos found in workspace, skipping push");
    return;
  }

  logger.log("Pushing org repos", { orgNames });

  for (const orgName of orgNames) {
    const orgPath = `${WORKSPACE_ORGS}/${orgName}`;

    logger.log("Processing org repo", { path: orgPath });

    // Configure git user inside the org repo
    await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "config", "user.email", "agent@recoupable.com"],
    });
    await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "config", "user.name", "Recoup Agent"],
    });

    // Stage all changes
    await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "add", "-A"],
    });

    // Check if there are changes to commit
    const diffResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "diff", "--cached", "--quiet"],
    });

    if (diffResult.exitCode === 0) {
      logger.log("No changes in org repo, skipping", { orgName });
      continue;
    }

    // Commit changes
    const commitResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "commit", "-m", "Update org files"],
    });

    if (commitResult.exitCode !== 0) {
      const stderr = (await commitResult.stderr()) || "";
      logger.error("Failed to commit org repo changes", {
        orgName,
        stderr,
      });
      continue;
    }

    // Push to remote
    const pushResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgPath, "push", "--force", "origin", "HEAD:main"],
    });

    if (pushResult.exitCode !== 0) {
      const stderr = (await pushResult.stderr()) || "";
      logger.error("Failed to push org repo", { orgName, stderr });
      continue;
    }

    logger.log("Org repo pushed successfully", { orgName });
  }
}

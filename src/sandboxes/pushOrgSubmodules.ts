import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Commits and pushes changes inside each org submodule before the
 * parent account repo is pushed. This ensures submodule commit refs
 * are up-to-date when the parent stages its `git add -A`.
 *
 * Parses `.gitmodules` to find submodule paths under `orgs/`.
 * Skips submodules with no changes.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function pushOrgSubmodules(sandbox: Sandbox): Promise<void> {
  // Check if .gitmodules exists
  const check = await sandbox.runCommand({
    cmd: "test",
    args: ["-f", ".gitmodules"],
  });

  if (check.exitCode !== 0) {
    logger.log("No .gitmodules found, skipping org submodule push");
    return;
  }

  // Parse submodule paths from .gitmodules
  const catResult = await sandbox.runCommand({
    cmd: "git",
    args: ["config", "--file", ".gitmodules", "--get-regexp", "path"],
  });

  if (catResult.exitCode !== 0) {
    logger.log("No submodules configured, skipping org submodule push");
    return;
  }

  const stdout = (await catResult.stdout()) || "";
  const paths = stdout
    .split("\n")
    .filter((line) => line.includes("orgs/"))
    .map((line) => line.split(" ").pop()!)
    .filter(Boolean);

  if (paths.length === 0) {
    logger.log("No org submodule paths found");
    return;
  }

  logger.log("Pushing org submodules", { paths });

  for (const submodulePath of paths) {
    logger.log("Processing org submodule", { path: submodulePath });

    // Configure git user inside the submodule
    await sandbox.runCommand({
      cmd: "git",
      args: [
        "-C",
        submodulePath,
        "config",
        "user.email",
        "agent@recoupable.com",
      ],
    });

    await sandbox.runCommand({
      cmd: "git",
      args: ["-C", submodulePath, "config", "user.name", "Recoup Agent"],
    });

    // Stage all changes
    await sandbox.runCommand({
      cmd: "git",
      args: ["-C", submodulePath, "add", "-A"],
    });

    // Check if there are changes to commit
    const diffResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", submodulePath, "diff", "--cached", "--quiet"],
    });

    if (diffResult.exitCode === 0) {
      logger.log("No changes in org submodule, skipping", {
        path: submodulePath,
      });
      continue;
    }

    // Commit changes
    const commitResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", submodulePath, "commit", "-m", "Update org files"],
    });

    if (commitResult.exitCode !== 0) {
      const stderr = (await commitResult.stderr()) || "";
      logger.error("Failed to commit org submodule changes", {
        path: submodulePath,
        stderr,
      });
      continue;
    }

    // Push to remote
    const pushResult = await sandbox.runCommand({
      cmd: "git",
      args: [
        "-C",
        submodulePath,
        "push",
        "--force",
        "origin",
        "HEAD:main",
      ],
    });

    if (pushResult.exitCode !== 0) {
      const stderr = (await pushResult.stderr()) || "";
      logger.error("Failed to push org submodule", {
        path: submodulePath,
        stderr,
      });
      continue;
    }

    logger.log("Org submodule pushed successfully", { path: submodulePath });
  }
}

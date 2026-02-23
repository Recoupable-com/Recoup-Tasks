import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Converts plain org directories in the account repo into git submodule
 * references pointing to their respective org GitHub repos.
 *
 * Called AFTER `copyOpenClawToRepo` (which copies org dirs as plain files)
 * and `pushOrgRepos` (which pushes org changes to their GitHub repos).
 *
 * For each org repo found in `~/.openclaw/workspace/orgs/`:
 * 1. Gets the remote URL (stripped of auth tokens)
 * 2. Removes the plain directory copy from the git index
 * 3. Adds it as a git submodule via `git submodule add`
 *
 * Uses git URL rewriting so `.gitmodules` contains clean public URLs
 * while cloning still works with authentication.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function registerOrgSubmodules(
  sandbox: Sandbox
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.log("No GITHUB_TOKEN, skipping org submodule registration");
    return;
  }

  // Resolve ~ to absolute path
  const homeResult = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "echo ~"],
  });
  const homeDir = ((await homeResult.stdout()) || "").trim() || "/root";
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

  // Find org directories that are git repos
  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${workspaceOrgs} -mindepth 1 -maxdepth 1 -type d -exec test -d {}/.git \\; -print 2>/dev/null | xargs -I{} basename {}`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) {
    logger.log("No org repos found, skipping submodule registration");
    return;
  }

  logger.log("Registering org submodules", { orgNames });

  // Set up git URL rewriting so private repos can be cloned
  // without embedding tokens in .gitmodules
  await sandbox.runCommand({
    cmd: "git",
    args: [
      "config",
      `url.https://x-access-token:${githubToken}@github.com/.insteadOf`,
      "https://github.com/",
    ],
  });

  // Clean up any existing submodule state for idempotency
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git submodule deinit --all -f 2>/dev/null || true"],
  });
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "rm -f .gitmodules 2>/dev/null || true"],
  });
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "rm -rf .git/modules 2>/dev/null || true"],
  });

  // Remove stale orgs/ submodules at repo root from old approach
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git rm -r --cached orgs 2>/dev/null || true"],
  });
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "rm -rf orgs 2>/dev/null || true"],
  });

  for (const orgName of orgNames) {
    const orgSrcPath = `${workspaceOrgs}/${orgName}`;
    const submodulePath = `.openclaw/workspace/orgs/${orgName}`;

    // Get remote URL from the working copy
    const urlResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", orgSrcPath, "remote", "get-url", "origin"],
    });

    let remoteUrl = ((await urlResult.stdout()) || "").trim();

    if (!remoteUrl) {
      logger.error("No remote URL for org repo, skipping", { orgName });
      continue;
    }

    // Strip auth token from URL for clean .gitmodules
    remoteUrl = remoteUrl.replace(
      /https:\/\/x-access-token:[^@]+@github\.com\//,
      "https://github.com/"
    );

    logger.log("Adding org submodule", { orgName, remoteUrl, submodulePath });

    // Remove the plain directory from git index (staged by copyOpenClawToRepo)
    await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `git rm -r --cached ${submodulePath} 2>/dev/null || true`,
      ],
    });

    // Remove the plain directory from working tree
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", `rm -rf ${submodulePath}`],
    });

    // Add as submodule — this clones the repo and creates the gitlink entry
    const addResult = await sandbox.runCommand({
      cmd: "git",
      args: ["submodule", "add", remoteUrl, submodulePath],
    });

    if (addResult.exitCode !== 0) {
      const stderr = (await addResult.stderr()) || "";
      logger.error("Failed to add org submodule", { orgName, stderr });
    }
  }

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

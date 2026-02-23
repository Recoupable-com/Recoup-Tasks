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
 * 1. Gets the remote URL (with auth token for cloning)
 * 2. Removes the plain directory copy from the git index
 * 3. Adds it as a git submodule via `git submodule add` with authed URL
 * 4. Strips auth tokens from `.gitmodules` via sed
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

  // Clean up any existing submodule state for idempotency.
  // ORDER MATTERS: git rm of submodule gitlinks updates .gitmodules
  // automatically. If .gitmodules is removed first, git rm re-stages it
  // in the index, causing "please make sure .gitmodules is in the working
  // tree" errors on subsequent git submodule add.

  // 1. Deinit submodules (clears working tree content)
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git submodule deinit --all -f 2>/dev/null || true"],
  });

  // 2. Remove stale orgs/ submodule gitlinks WHILE .gitmodules still exists
  //    so git rm can properly update .gitmodules
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git rm -rf orgs 2>/dev/null || true"],
  });

  // 3. NOW remove .gitmodules (already updated/emptied by git rm above)
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git rm -f .gitmodules 2>/dev/null || true"],
  });

  // 4. Clear modules cache and working tree remnants
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "rm -rf .git/modules orgs 2>/dev/null || true"],
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

    // Ensure URL has auth token so git submodule add can clone.
    // git config insteadOf doesn't work in sandboxes, so we embed
    // the token directly and strip it from .gitmodules afterward.
    if (!remoteUrl.includes("x-access-token")) {
      remoteUrl = remoteUrl.replace(
        "https://github.com/",
        `https://x-access-token:${githubToken}@github.com/`
      );
    }

    logger.log("Adding org submodule", { orgName, submodulePath });

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

  // Strip auth tokens from .gitmodules so they aren't committed.
  // The authed URLs were needed for cloning, but .gitmodules should
  // only contain clean public URLs.
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `sed -i 's|https://x-access-token:[^@]*@github.com/|https://github.com/|g' .gitmodules 2>/dev/null || true`,
    ],
  });

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

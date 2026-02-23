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

  // Clean up ALL submodule/org entries from the index using plumbing commands.
  // git update-index --force-remove manipulates the index directly without
  // any .gitmodules side effects (unlike git rm which auto-updates .gitmodules).

  // 1. Deinit submodules (clears working tree content)
  await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "git submodule deinit --all -f 2>/dev/null || true"],
  });

  // 2. Remove .gitmodules from index (no side effects)
  await sandbox.runCommand({
    cmd: "git",
    args: ["update-index", "--force-remove", ".gitmodules"],
  });

  // 3. Remove all .openclaw/workspace/orgs/ entries from index
  //    Use ls-files to find them, then force-remove each
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "git ls-files --stage .openclaw/workspace/orgs/ | awk '{print $4}' | xargs -I{} git update-index --force-remove {} 2>/dev/null || true",
    ],
  });

  // 4. Remove stale orgs/ entries at root (from old approach)
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "git ls-files --stage orgs/ | awk '{print $4}' | xargs -I{} git update-index --force-remove {} 2>/dev/null || true",
    ],
  });

  // 5. Clean working tree + module cache
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "rm -f .gitmodules && rm -rf .git/modules .openclaw/workspace/orgs orgs 2>/dev/null || true",
    ],
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

    // Remove the plain directory from working tree (index already cleaned above)
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
  // only contain clean public URLs. sed modifies the working tree;
  // we must re-stage so the committed version is also clean.
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `sed -i 's|https://x-access-token:[^@]*@github.com/|https://github.com/|g' .gitmodules 2>/dev/null || true`,
    ],
  });
  await sandbox.runCommand({
    cmd: "git",
    args: ["add", ".gitmodules"],
  });

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

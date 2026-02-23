import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Delegates submodule registration to OpenClaw, which handles the git
 * complexity of converting plain org directories into submodule references.
 *
 * Called AFTER `copyOpenClawToRepo` (which copies org dirs as plain files)
 * and `pushOrgRepos` (which pushes org changes to their GitHub repos).
 *
 * Previous approach of manually running git submodule add / git rm / git
 * update-index kept failing with ".gitmodules not in the working tree"
 * due to index/working-tree mismatches. OpenClaw can inspect and adapt.
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

  logger.log("Registering org submodules via OpenClaw", { orgNames });

  const orgList = orgNames.map((name) => `- ${name}`).join("\n");

  const message = [
    "Register the following org directories as git submodules in the current repo.",
    "Each org has a git repo at ~/.openclaw/workspace/orgs/{name} with a remote origin.",
    "",
    "Org directories:",
    orgList,
    "",
    "For each org:",
    "1. Get the remote URL: git -C ~/.openclaw/workspace/orgs/{name} remote get-url origin",
    "2. Clean up any existing submodule state for this path (deinit, remove from index, remove .git/modules/{path})",
    "3. Remove the plain directory copy at .openclaw/workspace/orgs/{name} in the repo if it exists",
    "4. Run: git submodule add <remote-url> .openclaw/workspace/orgs/{name}",
    "   - Use GITHUB_TOKEN env var for auth: replace https://github.com/ with https://x-access-token:$GITHUB_TOKEN@github.com/",
    "5. After ALL submodules are added, strip x-access-token auth from .gitmodules so tokens are not committed",
    "6. Re-stage .gitmodules: git add .gitmodules",
    "",
    "IMPORTANT:",
    "- Work in the repo root directory",
    "- If .gitmodules already exists in the index but not the working tree, remove it from the index first (git update-index --force-remove .gitmodules)",
    "- Handle errors gracefully — if a step fails, inspect the state and try to fix it",
  ].join("\n");

  // GITHUB_TOKEN is already injected into openclaw.json by setupOpenClaw
  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", message],
  });

  const resultStdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("OpenClaw submodule registration result", {
    exitCode: result.exitCode,
    stdout: resultStdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    logger.error("OpenClaw submodule registration failed", { stderr });
  }

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

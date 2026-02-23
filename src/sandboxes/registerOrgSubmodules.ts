import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runOpenClawAgent } from "./runOpenClawAgent";

/**
 * Delegates org repo pushing and submodule registration to OpenClaw.
 *
 * OpenClaw handles:
 * 1. Committing and pushing changes in each org repo to its GitHub remote
 * 2. Converting plain org directories into git submodule references
 * 3. Stripping auth tokens from .gitmodules
 *
 * Called AFTER `copyOpenClawToRepo` (which copies org dirs as plain files).
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
    "Push changes and register submodules for the following org repos.",
    "Each org has a git repo at ~/.openclaw/workspace/orgs/{name} with a remote origin.",
    "",
    "Org directories:",
    orgList,
    "",
    "STEP 1: commit and push each org repo to its own remote",
    "For each org:",
    "1. Configure git user: email agent@recoupable.com, name Recoup Agent",
    "2. Stage all changes: git -C ~/.openclaw/workspace/orgs/{name} add -A",
    "3. Check for changes: git -C ~/.openclaw/workspace/orgs/{name} diff --cached --quiet",
    "4. If changes exist, commit: git -C ~/.openclaw/workspace/orgs/{name} commit -m 'Update org files'",
    "5. Push to origin: git -C ~/.openclaw/workspace/orgs/{name} push --force origin HEAD:main",
    "6. Skip orgs with no changes",
    "",
    "STEP 2: register each org as a git submodule in the account repo",
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
    "- Work in the repo root directory for step 2",
    "- If .gitmodules already exists in the index but not the working tree, remove it from the index first (git update-index --force-remove .gitmodules)",
    "- Handle errors gracefully — if a step fails, inspect the state and try to fix it",
  ].join("\n");

  // GITHUB_TOKEN is already injected into openclaw.json by setupOpenClaw
  await runOpenClawAgent(sandbox, {
    label: "Pushing org repos and registering submodules",
    message,
  });

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

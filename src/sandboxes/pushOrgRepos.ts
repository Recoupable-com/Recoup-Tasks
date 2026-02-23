import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runOpenClawAgent } from "./runOpenClawAgent";

/**
 * Pushes changes in each org repo to its GitHub remote via OpenClaw.
 *
 * This is the AI-delegated half of org handling: OpenClaw commits and
 * force-pushes each org repo. The deterministic submodule registration
 * happens later in `copyOpenClawToRepo`.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function pushOrgRepos(
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

  logger.log("Pushing org repo changes via OpenClaw", { orgNames });

  const message = [
    "Commit and push changes for each org repo.",
    "Org repos are at ~/.openclaw/workspace/orgs/",
    "",
    "For each org directory that is a git repo:",
    "1. git add -A",
    "2. git commit -m 'Update org files' (skip if nothing to commit)",
    "3. git push origin HEAD:main --force (always push if there are unpushed commits)",
  ].join("\n");

  await runOpenClawAgent(sandbox, {
    label: "Pushing org repo changes",
    message,
  });

  logger.log("Org repo push complete", {
    count: orgNames.length,
  });
}

import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runOpenClawAgent } from "../runOpenClawAgent";
import { getSandboxHomeDir } from "../getSandboxHomeDir";
import { logStep } from "../logStep";

/**
 * Syncs all org repos in the sandbox workspace to their latest remote state
 * via an OpenClaw agent prompt.
 *
 * This ensures org repos are up-to-date with their remote `main` branch
 * before any commands run, preventing stale snapshots from causing
 * force-pushes that delete already-merged commits.
 *
 * Must be called AFTER `ensureOrgRepos` and BEFORE running commands.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function syncOrgRepos(sandbox: Sandbox): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.log("No GITHUB_TOKEN, skipping org repo sync");
    return;
  }

  const homeDir = await getSandboxHomeDir(sandbox);
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

  // Check if any org repos exist before prompting OpenClaw
  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${workspaceOrgs} -mindepth 1 -maxdepth 1 -type d 2>/dev/null | while read dir; do if [ -d "$dir/.git" ] || [ -f "$dir/.git" ]; then basename "$dir"; fi; done`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) {
    logger.log("No org repos found, skipping sync");
    return;
  }

  logStep("Syncing org repos");

  const message = [
    "Sync all org repos to the latest remote state.",
    "Org repos are at ~/.openclaw/workspace/orgs/",
    "",
    "For each org directory that is a git repo (has a .git directory or .git file):",
    "1. git fetch origin main",
    "2. git reset --hard origin/main",
    "",
    "This ensures we have the latest commits before making any changes.",
    "Continue to the next repo if one fails.",
  ].join("\n");

  await runOpenClawAgent(sandbox, {
    label: "Syncing org repos to latest remote",
    message,
  });

  logger.log("Org repo sync complete", { orgNames });
  logStep("Org repos synced");
}

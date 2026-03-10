import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getSandboxHomeDir } from "../getSandboxHomeDir";
import { logStep } from "../logStep";

/**
 * Pulls the latest changes from all org repos in the sandbox workspace.
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

  // Find org directories that are git repos (directory .git or file .git for submodules)
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

  const results: string[] = [];

  for (const name of orgNames) {
    const repoPath = `${workspaceOrgs}/${name}`;

    // Fetch and reset to origin/main to ensure we're fully up-to-date
    const fetchResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", repoPath, "fetch", "origin", "main"],
    });

    if (fetchResult.exitCode !== 0) {
      const stderr = (await fetchResult.stderr()) || "";
      logger.error(`Failed to fetch ${name}`, { stderr });
      results.push(`${name}: fetch failed`);
      continue;
    }

    const resetResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", repoPath, "reset", "--hard", "origin/main"],
    });

    if (resetResult.exitCode !== 0) {
      const stderr = (await resetResult.stderr()) || "";
      logger.error(`Failed to reset ${name}`, { stderr });
      results.push(`${name}: reset failed`);
      continue;
    }

    results.push(`${name}: synced`);
  }

  logger.log("Org repo sync complete", { results });
  logStep("Org repos synced");
}

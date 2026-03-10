import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "../runOpenClawAgent";
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
    logStep("No GITHUB_TOKEN, skipping org repo sync", false);
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
    "If there are no org repos, that's fine — just skip.",
    "Continue to the next repo if one fails.",
  ].join("\n");

  await runOpenClawAgent(sandbox, {
    label: "Syncing org repos to latest remote",
    message,
  });

  logStep("Org repos synced", false);
}

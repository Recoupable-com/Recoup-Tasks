import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "../runOpenClawAgent";
import { logStep } from "../logStep";

/**
 * Syncs all monorepo submodules to their latest remote base branch
 * via an OpenClaw agent prompt.
 *
 * This ensures PRs are created against the most up-to-date reference,
 * preventing stale base branches from causing merge conflicts.
 *
 * Must be called AFTER `cloneMonorepoViaAgent` and BEFORE running the
 * coding agent.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function syncMonorepoSubmodules(sandbox: Sandbox): Promise<void> {
  logStep("Syncing monorepo submodules");

  const message = [
    "Sync all monorepo submodules to their latest remote base branch.",
    "The monorepo is at ~/.openclaw/workspace/Recoup-Monorepo/",
    "",
    "For each submodule directory:",
    "1. cd into the submodule",
    "2. git fetch origin",
    "3. git checkout the base branch (main or test depending on the repo)",
    "4. git reset --hard origin/<baseBranch>",
    "",
    "This ensures each submodule has the latest commits from its base branch",
    "before any changes are made.",
    "Continue to the next submodule if one fails.",
  ].join("\n");

  await runOpenClawAgent(sandbox, {
    label: "Syncing monorepo submodules to latest remote",
    message,
  });

  logStep("Monorepo submodules synced", false);
}

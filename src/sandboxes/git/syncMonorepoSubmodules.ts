import type { Sandbox } from "@vercel/sandbox";
import { runOpenClawAgent } from "../runOpenClawAgent";
import { logStep } from "../logStep";
import { SUBMODULE_CONFIG } from "../submoduleConfig";

/**
 * Syncs all monorepo submodules to their latest remote base branch
 * via an OpenClaw agent prompt.
 *
 * Uses SUBMODULE_CONFIG to determine the correct base branch for each
 * submodule (e.g. "test" for api/chat, "main" for others). This ensures
 * PRs are created against the most up-to-date reference, preventing
 * stale base branches from causing merge conflicts.
 *
 * Must be called AFTER `cloneMonorepoViaAgent` and BEFORE running the
 * coding agent.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function syncMonorepoSubmodules(sandbox: Sandbox): Promise<void> {
  logStep("Syncing monorepo submodules");

  const submoduleLines = Object.entries(SUBMODULE_CONFIG)
    .map(([name, { baseBranch }]) => `  - ${name}: base branch=${baseBranch}`)
    .join("\n");

  const message = [
    "Sync all monorepo submodules to their latest remote base branch.",
    "The monorepo is at ~/.openclaw/workspace/Recoup-Monorepo/",
    "",
    "Submodule config (name: base branch):",
    submoduleLines,
    "",
    "For each submodule listed above:",
    "1. cd into the submodule directory (e.g. Recoup-Monorepo/<name>)",
    "2. git fetch origin <baseBranch>",
    "3. git checkout <baseBranch>",
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

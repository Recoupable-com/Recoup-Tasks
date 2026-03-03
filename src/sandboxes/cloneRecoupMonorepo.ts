import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runGitCommand } from "./runGitCommand";
import { getSandboxHomeDir } from "./getSandboxHomeDir";
import { getGitHubAuthPrefix } from "./getGitHubAuthPrefix";

const MONOREPO_REPO = "recoupable/mono";

/**
 * Clones the Recoup monorepo with submodules into the sandbox.
 *
 * Uses a two-step approach to ensure nested submodules get auth:
 * 1. Clone the repo WITHOUT --recurse-submodules
 * 2. Set URL rewriting in the repo's local config
 * 3. Run `git submodule update --init --recursive` separately
 *
 * This avoids relying on --global git config which may not propagate
 * to submodule child processes in Vercel Sandboxes.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @returns The clone directory path on success, null on failure
 */
export async function cloneRecoupMonorepo(sandbox: Sandbox): Promise<string | null> {
  const authPrefix = getGitHubAuthPrefix();

  if (!authPrefix) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return null;
  }

  const homeDir = await getSandboxHomeDir(sandbox);
  const cloneDir = `${homeDir}/monorepo`;
  const authUrl = `${authPrefix}${MONOREPO_REPO}.git`;

  logger.log("Cloning Recoup monorepo", { repo: MONOREPO_REPO });

  // Step 1: Clone without submodules
  const cloneResult = await sandbox.runCommand({
    cmd: "git",
    args: ["clone", authUrl, cloneDir],
  });

  if (cloneResult.exitCode !== 0) {
    const stderr = (await cloneResult.stderr()) || "";
    logger.error("Failed to clone monorepo", { exitCode: cloneResult.exitCode, stderr });
    return null;
  }

  // Step 2: Configure URL rewriting in the repo's local config
  // so submodule fetches use the auth token (HTTPS + SSH)
  if (!await runGitCommand(
    sandbox,
    ["-C", cloneDir, "config", `url.${authPrefix}.insteadOf`, "https://github.com/"],
    "set HTTPS URL rewrite for auth",
  )) return null;

  if (!await runGitCommand(
    sandbox,
    ["-C", cloneDir, "config", `url.${authPrefix}.insteadOf`, "git@github.com:"],
    "set SSH URL rewrite for auth",
  )) return null;

  // Configure git user (non-critical — don't fail the clone)
  await runGitCommand(
    sandbox,
    ["-C", cloneDir, "config", "user.email", "agent@recoupable.com"],
    "set git user email",
  );

  await runGitCommand(
    sandbox,
    ["-C", cloneDir, "config", "user.name", "Recoup Agent"],
    "set git user name",
  );

  // Step 3: Init top-level submodules only (no --recursive).
  // Nested submodules (e.g. skills/) are left to the agent if needed,
  // following the same delegation pattern used for org submodules.
  if (!await runGitCommand(
    sandbox,
    ["-C", cloneDir, "submodule", "update", "--init"],
    "init and update submodules",
  )) return null;

  logger.log("Monorepo cloned successfully", { dir: cloneDir });

  return cloneDir;
}

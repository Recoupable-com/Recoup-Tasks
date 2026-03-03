import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runGitCommand } from "./runGitCommand";
import { getSandboxHomeDir } from "./getSandboxHomeDir";
import { getGitHubAuthPrefix } from "./getGitHubAuthPrefix";

const MONOREPO_REPO = "recoupable/mono";

/**
 * Clones the Recoup monorepo with submodules into the sandbox.
 * Sets up GitHub auth (HTTPS + SSH URL rewriting), git user config,
 * then clones with --recurse-submodules so nested submodules get auth.
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

  // Set up global URL rewriting BEFORE cloning so --recurse-submodules
  // can authenticate nested submodule fetches (e.g. skills/songwriting)
  await runGitCommand(
    sandbox,
    ["config", "--global", `url.${authPrefix}.insteadOf`, "https://github.com/"],
    "set global HTTPS URL rewrite for auth",
  );

  await runGitCommand(
    sandbox,
    ["config", "--global", `url.${authPrefix}.insteadOf`, "git@github.com:"],
    "set global SSH URL rewrite for auth",
  );

  const authUrl = `${authPrefix}${MONOREPO_REPO}.git`;

  logger.log("Cloning Recoup monorepo with submodules", { repo: MONOREPO_REPO });

  const cloneResult = await sandbox.runCommand({
    cmd: "git",
    args: ["clone", "--recurse-submodules", authUrl, cloneDir],
  });

  if (cloneResult.exitCode !== 0) {
    const stderr = (await cloneResult.stderr()) || "";
    logger.error("Failed to clone monorepo", { exitCode: cloneResult.exitCode, stderr });
    return null;
  }

  // Configure git user
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

  logger.log("Monorepo cloned successfully", { dir: cloneDir });

  return cloneDir;
}

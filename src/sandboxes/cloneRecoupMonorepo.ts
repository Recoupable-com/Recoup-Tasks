import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { runGitCommand } from "./runGitCommand";

const MONOREPO_REPO = "recoupable/Recoup-Monorepo";
const CLONE_DIR = "/root/monorepo";

/**
 * Clones the Recoup monorepo with submodules into the sandbox.
 * Sets up GitHub auth, git user config, and URL rewriting.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @returns true if clone succeeded, false otherwise
 */
export async function cloneRecoupMonorepo(sandbox: Sandbox): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return false;
  }

  const authUrl = `https://x-access-token:${githubToken}@github.com/${MONOREPO_REPO}.git`;

  logger.log("Cloning Recoup monorepo with submodules", { repo: MONOREPO_REPO });

  const cloneResult = await sandbox.runCommand({
    cmd: "git",
    args: ["clone", "--recurse-submodules", authUrl, CLONE_DIR],
  });

  if (cloneResult.exitCode !== 0) {
    const stderr = (await cloneResult.stderr()) || "";
    logger.error("Failed to clone monorepo", { exitCode: cloneResult.exitCode, stderr });
    return false;
  }

  // Configure git user
  await runGitCommand(
    sandbox,
    ["-C", CLONE_DIR, "config", "user.email", "agent@recoupable.com"],
    "set git user email",
  );

  await runGitCommand(
    sandbox,
    ["-C", CLONE_DIR, "config", "user.name", "Recoup Agent"],
    "set git user name",
  );

  // Set up URL rewriting so submodule pushes use auth
  await runGitCommand(
    sandbox,
    [
      "-C", CLONE_DIR, "config",
      `url.https://x-access-token:${githubToken}@github.com/.insteadOf`,
      "https://github.com/",
    ],
    "set URL rewrite for auth",
  );

  logger.log("Monorepo cloned successfully", { dir: CLONE_DIR });

  return true;
}

import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountSandboxes } from "../recoup/getAccountSandboxes";
import { runGitCommand } from "./runGitCommand";

/**
 * Ensures a GitHub repository is cloned in the sandbox.
 *
 * The API now handles repo creation during POST /api/sandboxes.
 * This function only needs to:
 * 1. Fetch the github_repo URL from the API
 * 2. Clone it into the sandbox if not already cloned
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID
 * @returns The github repo URL, or undefined if not configured or setup failed
 */
export async function ensureGithubRepo(
  sandbox: Sandbox,
  accountId: string
): Promise<string | undefined> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  // Fetch github_repo from the API (created during POST /api/sandboxes)
  const sandboxesInfo = await getAccountSandboxes(accountId);
  const githubRepo = sandboxesInfo?.githubRepo ?? null;

  if (!githubRepo) {
    logger.warn("No GitHub repo configured for account", { accountId });
    return undefined;
  }

  // Check if repo is already cloned in the sandbox
  const gitCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", ".git"],
  });

  if (gitCheck.exitCode === 0) {
    logger.log("GitHub repo already cloned in sandbox", { githubRepo });
    return githubRepo;
  }

  // Clone the repo into the sandbox root
  logger.log("Cloning GitHub repo into sandbox root", { githubRepo });

  const repoUrl = githubRepo.replace(
    "https://github.com/",
    `https://x-access-token:${githubToken}@github.com/`
  );

  if (!(await runGitCommand(sandbox, ["init"], "initialize git"))) {
    return undefined;
  }

  if (
    !(await runGitCommand(
      sandbox,
      ["remote", "add", "origin", repoUrl],
      "add remote"
    ))
  ) {
    return undefined;
  }

  // Fetch and checkout only if the remote has content
  const fetchResult = await sandbox.runCommand({
    cmd: "git",
    args: ["fetch", "origin"],
  });

  if (fetchResult.exitCode === 0) {
    // Check if origin/main exists (won't for empty repos)
    const refCheck = await sandbox.runCommand({
      cmd: "git",
      args: ["rev-parse", "--verify", "origin/main"],
    });

    if (refCheck.exitCode === 0) {
      if (
        !(await runGitCommand(
          sandbox,
          ["checkout", "-B", "main", "origin/main"],
          "checkout main branch"
        ))
      ) {
        return undefined;
      }
    } else {
      logger.log("Empty remote repo, skipping checkout");
    }
  } else {
    logger.log("Fetch failed or empty remote, skipping checkout");
  }

  logger.log("GitHub repo initialized in sandbox root", {
    githubRepo,
  });

  return githubRepo;
}

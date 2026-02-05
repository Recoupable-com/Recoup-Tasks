import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountSandboxes } from "../recoup/getAccountSandboxes";
import { getAccount } from "../recoup/getAccount";
import { createGithubRepo } from "../github/createGithubRepo";

/**
 * Runs a git command in the sandbox and logs stderr on failure.
 *
 * @returns true if the command succeeded, false otherwise
 */
async function runGitCommand(
  sandbox: Sandbox,
  args: string[],
  description: string
): Promise<boolean> {
  const result = await sandbox.runCommand({ cmd: "git", args });

  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()) || "";
    const stdout = (await result.stdout()) || "";
    logger.error(`Failed to ${description}`, {
      exitCode: result.exitCode,
      stderr,
      stdout,
    });
    return false;
  }

  return true;
}

/**
 * Ensures a GitHub repository exists for the account and is cloned in the sandbox.
 *
 * 1. Checks if the account already has a github_repo configured
 * 2. If not, fetches the account name and creates a new private repo
 * 3. Checks if the repo is already cloned in the sandbox (via .git directory)
 * 4. If not cloned, initializes git and pulls the repo into the sandbox root
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID
 * @returns The github repo URL, or undefined if setup failed
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

  // Step 1: Check if github_repo is already configured
  const sandboxesInfo = await getAccountSandboxes(accountId);
  let githubRepo = sandboxesInfo?.githubRepo ?? null;

  // Step 2: If no github_repo, create one
  if (!githubRepo) {
    logger.log("No GitHub repo configured, creating one", { accountId });

    const account = await getAccount(accountId);

    if (!account) {
      logger.error("Failed to fetch account info for repo creation", {
        accountId,
      });
      return undefined;
    }

    const newRepo = await createGithubRepo(account.name, account.id);

    if (!newRepo) {
      logger.error("Failed to create GitHub repo", { accountId });
      return undefined;
    }

    githubRepo = newRepo;
  }

  // Step 3: Check if repo is already cloned in the sandbox
  logger.log("Checking if repo is cloned in sandbox");

  const gitCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", ".git"],
  });

  if (gitCheck.exitCode === 0) {
    logger.log("GitHub repo already cloned in sandbox", { githubRepo });
    return githubRepo;
  }

  // Step 4: Clone the repo into the sandbox root
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

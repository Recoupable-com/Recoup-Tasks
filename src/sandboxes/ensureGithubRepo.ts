import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountSandboxes } from "../recoup/getAccountSandboxes";
import { getAccount } from "../recoup/getAccount";
import { createGithubRepo } from "../github/createGithubRepo";

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

  const initResult = await sandbox.runCommand({
    cmd: "git",
    args: ["init"],
  });

  if (initResult.exitCode !== 0) {
    logger.error("Failed to initialize git", {
      exitCode: initResult.exitCode,
    });
    return undefined;
  }

  const remoteResult = await sandbox.runCommand({
    cmd: "git",
    args: ["remote", "add", "origin", repoUrl],
  });

  if (remoteResult.exitCode !== 0) {
    logger.error("Failed to add remote", {
      exitCode: remoteResult.exitCode,
    });
    return undefined;
  }

  const fetchResult = await sandbox.runCommand({
    cmd: "git",
    args: ["fetch", "origin"],
  });

  if (fetchResult.exitCode !== 0) {
    logger.error("Failed to fetch from remote", {
      exitCode: fetchResult.exitCode,
    });
    return undefined;
  }

  const checkoutResult = await sandbox.runCommand({
    cmd: "git",
    args: ["checkout", "-f", "main"],
  });

  if (checkoutResult.exitCode !== 0) {
    logger.error("Failed to checkout main branch", {
      exitCode: checkoutResult.exitCode,
    });
    return undefined;
  }

  logger.log("GitHub repo cloned successfully into sandbox root", {
    githubRepo,
  });

  return githubRepo;
}

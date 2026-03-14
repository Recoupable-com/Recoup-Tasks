import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountSandboxes } from "../recoup/getAccountSandboxes";
import { getAccount } from "../recoup/getAccount";
import { createGithubRepo } from "../github/createGithubRepo";
import { updateAccountSnapshot } from "../recoup/updateAccountSnapshot";
import { runGitCommand } from "./runGitCommand";
import { getGitHubAuthPrefix } from "./getGitHubAuthPrefix";

/**
 * Ensures a GitHub repository exists for the account, is persisted, and
 * is cloned into the sandbox.
 *
 * 1. Fetch `github_repo` from GET /api/sandboxes
 * 2. If missing → get account name → create repo → persist via PATCH /api/sandboxes
 * 3. Clone into sandbox (idempotent — skips if .git already present)
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID
 * @returns The github repo URL, or undefined if not configured or setup failed
 */
export async function ensureGithubRepo(
  sandbox: Sandbox,
  accountId: string,
): Promise<string | undefined> {
  const authPrefix = getGitHubAuthPrefix();

  if (!authPrefix) {
    logger.error("Missing GITHUB_TOKEN environment variable");
    return undefined;
  }

  // Fetch github_repo from the API
  const sandboxesInfo = await getAccountSandboxes(accountId);
  let githubRepo = sandboxesInfo?.githubRepo ?? null;

  // If no repo exists, create one
  if (!githubRepo) {
    logger.log("No GitHub repo found, creating one", { accountId });

    const account = await getAccount(accountId);

    if (!account) {
      logger.error("Account not found for repo creation", { accountId });
      return undefined;
    }

    const repoUrl = await createGithubRepo(account.name, accountId);

    if (!repoUrl) {
      logger.error("Failed to create GitHub repo", { accountId });
      return undefined;
    }

    // Persist the repo URL via PATCH /api/sandboxes
    logger.log("Persisting GitHub repo URL", { accountId, repoUrl });
    const snapshotId = sandboxesInfo?.snapshotId ?? undefined;
    await updateAccountSnapshot(accountId, snapshotId, repoUrl);

    githubRepo = repoUrl;
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

  const repoUrl = githubRepo.replace("https://github.com/", authPrefix);

  if (!(await runGitCommand(sandbox, ["init"], "initialize git"))) {
    return undefined;
  }

  if (!(await runGitCommand(sandbox, ["remote", "add", "origin", repoUrl], "add remote"))) {
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
          "checkout main branch",
        ))
      ) {
        return undefined;
      }

      // Set up URL rewriting so submodule clones use auth
      await sandbox.runCommand({
        cmd: "git",
        args: ["config", `url.${authPrefix}.insteadOf`, "https://github.com/"],
      });

      // Initialize submodules if they exist (org repos)
      await sandbox.runCommand({
        cmd: "git",
        args: ["submodule", "update", "--init", "--recursive"],
      });
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

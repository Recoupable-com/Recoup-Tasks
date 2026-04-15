import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountOrgs } from "../recoup/getAccountOrgs";
import { createOrgGithubRepo } from "../github/createOrgGithubRepo";
import { sanitizeRepoName } from "../github/sanitizeRepoName";
import { logStep } from "./logStep";
import { getSandboxHomeDir } from "./getSandboxHomeDir";
import { getGitHubAuthPrefix } from "./getGitHubAuthPrefix";

/**
 * Ensures each of the account's organizations has a GitHub repo and
 * is cloned into orgs/ in the OpenClaw workspace.
 *
 * Clones deterministically via sandbox.runCommand — no AI agent delegation.
 * If a directory exists without .git, removes it and clones fresh.
 *
 * Must be called AFTER `setupOpenClaw` (so OpenClaw is available) and
 * BEFORE `ensureSetupSandbox` (so skills write into existing org dirs).
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID to look up orgs for
 */
export async function ensureOrgRepos(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  const authPrefix = getGitHubAuthPrefix();

  if (!authPrefix) {
    logger.error("Missing GITHUB_TOKEN for org repos");
    return;
  }

  logStep("Fetching account organizations");
  const orgs = await getAccountOrgs(accountId);

  if (!orgs || orgs.length === 0) {
    logger.log("No organizations found, skipping org repo setup");
    return;
  }

  logStep("Setting up org repos");

  const orgRepos: Array<{ name: string; url: string }> = [];

  for (const org of orgs) {
    const repoUrl = await createOrgGithubRepo(
      org.organizationName,
      org.organizationId
    );

    if (!repoUrl) {
      logger.error("Failed to create org GitHub repo, skipping", {
        orgId: org.organizationId,
        orgName: org.organizationName,
      });
      continue;
    }

    orgRepos.push({
      name: sanitizeRepoName(org.organizationName),
      url: repoUrl,
    });
  }

  if (orgRepos.length === 0) {
    logger.log("No org repos created, skipping clone step");
    return;
  }

  const homeDir = await getSandboxHomeDir(sandbox);
  const orgsDir = `${homeDir}/.openclaw/workspace/orgs`;

  await sandbox.runCommand({ cmd: "mkdir", args: ["-p", orgsDir] });

  for (const repo of orgRepos) {
    const repoDir = `${orgsDir}/${repo.name}`;
    const authedUrl = repo.url.replace("https://github.com/", authPrefix);

    const gitCheck = await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", `test -d ${repoDir}/.git || test -f ${repoDir}/.git`],
    });

    if (gitCheck.exitCode === 0) {
      logger.log("Org repo already cloned, pulling latest", { name: repo.name });
      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", repoDir, "pull", "origin", "main"],
      });
      continue;
    }

    // Directory exists but is not a git repo — remove and clone fresh
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", `rm -rf ${repoDir}`],
    });

    logger.log("Cloning org repo", { name: repo.name });
    const clone = await sandbox.runCommand({
      cmd: "git",
      args: ["clone", authedUrl, repoDir],
    });

    if (clone.exitCode !== 0) {
      logger.error("Failed to clone org repo", {
        name: repo.name,
        stderr: (await clone.stderr()) || "",
      });
    }
  }

  logStep("Org repo setup complete");
}

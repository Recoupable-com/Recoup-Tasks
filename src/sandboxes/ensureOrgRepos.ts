import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountOrgs } from "../recoup/getAccountOrgs";
import { createOrgGithubRepo } from "../github/createOrgGithubRepo";
import { sanitizeRepoName } from "../github/sanitizeRepoName";

/**
 * Ensures each of the account's organizations has a GitHub repo and
 * tells OpenClaw to clone them into `orgs/` in the workspace.
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
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.error("Missing GITHUB_TOKEN for org repos");
    return;
  }

  const orgs = await getAccountOrgs(accountId);

  if (!orgs || orgs.length === 0) {
    logger.log("No organizations found, skipping org repo setup");
    return;
  }

  logger.log("Setting up org repos", {
    accountId,
    orgCount: orgs.length,
  });

  // Create GitHub repos for each org and collect URLs
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

  // Build the prompt for OpenClaw to clone the repos
  const repoList = orgRepos
    .map((r) => `- "${r.name}" → ${r.url}`)
    .join("\n");

  const message = [
    "Clone the following GitHub repositories into orgs/ in your workspace.",
    "Use the GITHUB_TOKEN environment variable for authentication.",
    "Replace https://github.com/ with https://x-access-token:$GITHUB_TOKEN@github.com/ in the clone URL.",
    "",
    "If orgs/{name} already exists as a git repo, run: git -C orgs/{name} pull origin main",
    "If orgs/{name} exists but is NOT a git repo, remove it and clone fresh.",
    "If orgs/{name} does not exist, clone the repo.",
    "",
    repoList,
  ].join("\n");

  logger.log("Asking OpenClaw to clone org repos", {
    orgCount: orgRepos.length,
  });

  // GITHUB_TOKEN and RECOUP_API_KEY are injected into openclaw.json
  // by setupOpenClaw — no need to pass them via env here.
  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", message],
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("OpenClaw clone result", {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    logger.error("OpenClaw failed to clone org repos", { stderr });
  }

  logger.log("Org repo setup complete", {
    totalOrgs: orgs.length,
    reposCreated: orgRepos.length,
  });
}

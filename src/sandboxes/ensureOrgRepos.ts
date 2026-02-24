import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountOrgs } from "../recoup/getAccountOrgs";
import { createOrgGithubRepo } from "../github/createOrgGithubRepo";
import { sanitizeRepoName } from "../github/sanitizeRepoName";
import { runOpenClawAgent } from "./runOpenClawAgent";
import { logStep } from "./logStep";

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

  logStep("Fetching account organizations");
  const orgs = await getAccountOrgs(accountId);

  if (!orgs || orgs.length === 0) {
    logger.log("No organizations found, skipping org repo setup");
    return;
  }

  logStep("Setting up org repos");

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
    "For each repo, check orgs/{name}:",
    "- If it has a .git directory OR a .git file (submodule gitlink), it's already a git repo — run: git -C orgs/{name} pull origin main",
    "- If it exists but has neither a .git directory nor a .git file, remove it and clone fresh.",
    "- If it does not exist, clone the repo.",
    "",
    "IMPORTANT: Submodules use a .git file (gitlink), not a .git directory.",
    "Always check for BOTH: [ -d orgs/{name}/.git ] || [ -f orgs/{name}/.git ]",
    "",
    repoList,
  ].join("\n");

  // GITHUB_TOKEN and RECOUP_API_KEY are injected into openclaw.json
  // by setupOpenClaw — no need to pass them via env here.
  await runOpenClawAgent(sandbox, {
    label: "Cloning org repos",
    message,
  });

  logStep("Org repo setup complete");
}

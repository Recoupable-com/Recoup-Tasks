import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountOrgs } from "../recoup/getAccountOrgs";
import { createOrgGithubRepo } from "../github/createOrgGithubRepo";
import { sanitizeRepoName } from "../github/sanitizeRepoName";
import { runGitCommand } from "./runGitCommand";

/**
 * Ensures each of the account's organizations has a GitHub repo and is added
 * as a git submodule under `orgs/{sanitizedName}` in the sandbox.
 *
 * Must be called AFTER `ensureGithubRepo` (so `.git` exists) and BEFORE
 * `ensureSetupSandbox` (so skills write into existing submodule dirs).
 *
 * Idempotent — skips orgs that are already registered as submodules.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID to look up orgs for
 */
export async function ensureOrgSubmodules(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  const githubToken = process.env.GITHUB_TOKEN;

  if (!githubToken) {
    logger.error("Missing GITHUB_TOKEN for org submodules");
    return;
  }

  const orgs = await getAccountOrgs(accountId);

  if (!orgs || orgs.length === 0) {
    logger.log("No organizations found, skipping submodule setup");
    return;
  }

  logger.log("Setting up org submodules", {
    accountId,
    orgCount: orgs.length,
  });

  // Read existing .gitmodules to check what's already registered
  const gitmodulesCheck = await sandbox.runCommand({
    cmd: "cat",
    args: [".gitmodules"],
  });
  const existingGitmodules =
    gitmodulesCheck.exitCode === 0 ? (await gitmodulesCheck.stdout()) || "" : "";

  let addedCount = 0;

  for (const org of orgs) {
    const sanitizedName = sanitizeRepoName(org.organizationName);
    const submodulePath = `orgs/${sanitizedName}`;

    // Skip if already a submodule
    if (existingGitmodules.includes(`path = ${submodulePath}`)) {
      logger.log("Org submodule already exists, updating", {
        orgId: org.organizationId,
        path: submodulePath,
      });

      // Ensure submodule is initialized (e.g. after clone)
      await sandbox.runCommand({
        cmd: "git",
        args: ["submodule", "update", "--init", submodulePath],
      });

      continue;
    }

    // Create the org GitHub repo (idempotent — handles 422)
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

    // Build authenticated URL for submodule add
    const authedUrl = repoUrl.replace(
      "https://github.com/",
      `https://x-access-token:${githubToken}@github.com/`
    );

    logger.log("Adding org as submodule", {
      orgId: org.organizationId,
      path: submodulePath,
      repoUrl,
    });

    // Add as submodule
    const addResult = await sandbox.runCommand({
      cmd: "git",
      args: ["submodule", "add", authedUrl, submodulePath],
    });

    if (addResult.exitCode !== 0) {
      const stderr = (await addResult.stderr()) || "";
      logger.error("Failed to add org submodule", {
        orgId: org.organizationId,
        path: submodulePath,
        stderr,
      });
      continue;
    }

    // Rewrite .gitmodules to use the public URL (no token)
    await sandbox.runCommand({
      cmd: "git",
      args: [
        "config",
        "--file",
        ".gitmodules",
        `submodule.${submodulePath}.url`,
        repoUrl,
      ],
    });

    addedCount++;
  }

  if (addedCount > 0) {
    // Stage .gitmodules and submodule entries
    await runGitCommand(sandbox, ["add", ".gitmodules"], "stage .gitmodules");
    await runGitCommand(sandbox, ["add", "-A"], "stage submodule entries");

    // Commit submodule additions
    await runGitCommand(
      sandbox,
      ["commit", "-m", "Add org submodules"],
      "commit submodule additions"
    );

    logger.log("Org submodules committed", { addedCount });
  }

  logger.log("Org submodule setup complete", {
    totalOrgs: orgs.length,
    added: addedCount,
  });
}

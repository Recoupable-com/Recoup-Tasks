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

    // Check if the remote repo is empty (no refs) — git submodule add fails
    // on empty repos with "fatal: You are on a branch yet to be born"
    const lsRemote = await sandbox.runCommand({
      cmd: "git",
      args: ["ls-remote", "--heads", authedUrl],
    });

    const lsRemoteOutput =
      lsRemote.exitCode === 0 ? (await lsRemote.stdout()) || "" : "";

    if (lsRemoteOutput.trim() === "") {
      logger.log("Remote repo is empty, seeding with initial commit", {
        orgId: org.organizationId,
        repoUrl,
      });

      const seedDir = `/tmp/seed-${sanitizedName}`;

      // Initialize a temp repo, create a README, push to seed the remote
      await sandbox.runCommand({ cmd: "rm", args: ["-rf", seedDir] });
      await sandbox.runCommand({ cmd: "mkdir", args: ["-p", seedDir] });
      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "init"],
      });
      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "remote", "add", "origin", authedUrl],
      });
      await sandbox.runCommand({
        cmd: "git",
        args: [
          "-C",
          seedDir,
          "config",
          "user.email",
          "agent@recoupable.com",
        ],
      });
      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "config", "user.name", "Recoup Agent"],
      });

      await sandbox.writeFiles({
        [`${seedDir}/README.md`]: `# ${org.organizationName}\n`,
      });

      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "add", "-A"],
      });
      await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "commit", "-m", "Initial commit"],
      });

      const pushResult = await sandbox.runCommand({
        cmd: "git",
        args: ["-C", seedDir, "push", "-u", "origin", "HEAD:main"],
      });

      await sandbox.runCommand({ cmd: "rm", args: ["-rf", seedDir] });

      if (pushResult.exitCode !== 0) {
        const pushStderr = (await pushResult.stderr()) || "";
        logger.error("Failed to seed empty org repo", {
          orgId: org.organizationId,
          stderr: pushStderr,
        });
        continue;
      }

      logger.log("Empty org repo seeded successfully", {
        orgId: org.organizationId,
      });
    }

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

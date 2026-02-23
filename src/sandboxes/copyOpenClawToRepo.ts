import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Copies the OpenClaw config directory (~/.openclaw) into the sandbox
 * working directory, then registers org repos as git submodules.
 *
 * 1. Copies ~/.openclaw to /vercel/sandbox/.openclaw, excluding workspace/orgs/
 *    (those become submodules) and stripping nested .git directories.
 * 2. For each org repo, runs deterministic `git submodule add` with cleanup.
 * 3. Strips auth tokens from .gitmodules.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function copyOpenClawToRepo(sandbox: Sandbox): Promise<void> {
  logger.log("Copying ~/.openclaw into repo");

  // 1. Copy .openclaw excluding orgs/ (those become submodules)
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "rm -rf /vercel/sandbox/.openclaw && " +
        "cp -r ~/.openclaw /vercel/sandbox/.openclaw && " +
        "rm -rf /vercel/sandbox/.openclaw/workspace/orgs && " +
        "find /vercel/sandbox/.openclaw -name .git -type d -exec rm -rf {} + 2>/dev/null || true",
    ],
  });

  logger.log("OpenClaw files copied to repo");

  // 2. Register org repos as submodules
  if (!process.env.GITHUB_TOKEN) return;

  // Resolve home dir
  const homeResult = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "echo ~"],
  });
  const homeDir = ((await homeResult.stdout()) || "").trim() || "/root";
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

  // Find org repos (check for both -d .git dirs and -f .git gitlinks)
  const findResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `find ${workspaceOrgs} -mindepth 1 -maxdepth 1 -type d '(' -exec test -d {}/.git ';' -o -exec test -f {}/.git ';' ')' -print 2>/dev/null | xargs -I{} basename {}`,
    ],
  });

  const stdout = (await findResult.stdout()) || "";
  const orgNames = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (orgNames.length === 0) {
    logger.log("No org repos found, skipping submodule registration");
    return;
  }

  logger.log("Registering org submodules", { orgNames });

  for (const name of orgNames) {
    const orgPath = `.openclaw/workspace/orgs/${name}`;

    // Get remote URL
    const remoteResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", `${workspaceOrgs}/${name}`, "remote", "get-url", "origin"],
    });
    const remoteUrl = ((await remoteResult.stdout()) || "").trim();
    if (!remoteUrl) continue;

    // Skip if already registered as submodule
    const checkResult = await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `test -f ${orgPath}/.git && git config --file .gitmodules --get submodule.${orgPath}.url 2>/dev/null`,
      ],
    });
    if (checkResult.exitCode === 0) continue;

    // Clean up stale entries
    await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `git rm -r --cached ${orgPath} 2>/dev/null || true; ` +
          `git config --remove-section submodule.${orgPath} 2>/dev/null || true; ` +
          `rm -rf .git/modules/${orgPath} ${orgPath} 2>/dev/null || true`,
      ],
    });

    // Add as submodule with auth
    const authedUrl = remoteUrl.replace(
      "https://github.com/",
      `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`
    );
    await sandbox.runCommand({
      cmd: "git",
      args: ["submodule", "add", authedUrl, orgPath],
    });
  }

  // Strip auth tokens from .gitmodules
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "sed -i 's|https://x-access-token:[^@]*@github.com/|https://github.com/|g' .gitmodules 2>/dev/null || true; " +
        "git add .gitmodules 2>/dev/null || true",
    ],
  });

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

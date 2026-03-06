import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getSandboxHomeDir } from "../getSandboxHomeDir";
import { getGitHubAuthPrefix } from "../getGitHubAuthPrefix";

/**
 * Registers each org repo as a git submodule in the sandbox working directory.
 *
 * For each org repo found at ~/.openclaw/workspace/orgs/{name}:
 * 1. Gets the remote URL
 * 2. Skips if already registered as a submodule (idempotent)
 * 3. Cleans stale index/config entries
 * 4. Runs `git submodule add` with auth token
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function addOrgSubmodules(sandbox: Sandbox): Promise<void> {
  const authPrefix = getGitHubAuthPrefix();
  if (!authPrefix) return;

  const homeDir = await getSandboxHomeDir(sandbox);
  const workspaceOrgs = `${homeDir}/.openclaw/workspace/orgs`;

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

    const remoteResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", `${workspaceOrgs}/${name}`, "remote", "get-url", "origin"],
    });
    const remoteUrl = ((await remoteResult.stdout()) || "").trim();
    if (!remoteUrl) continue;

    const checkResult = await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `test -f ${orgPath}/.git && git config --file .gitmodules --get submodule.${orgPath}.url 2>/dev/null`,
      ],
    });
    if (checkResult.exitCode === 0) continue;

    await sandbox.runCommand({
      cmd: "sh",
      args: [
        "-c",
        `git rm -r --cached ${orgPath} 2>/dev/null || true; ` +
          `git config --remove-section submodule.${orgPath} 2>/dev/null || true; ` +
          `rm -rf .git/modules/${orgPath} ${orgPath} 2>/dev/null || true`,
      ],
    });

    const authedUrl = remoteUrl.replace("https://github.com/", authPrefix);
    await sandbox.runCommand({
      cmd: "git",
      args: ["submodule", "add", authedUrl, orgPath],
    });
  }

  logger.log("Org submodule registration complete", {
    count: orgNames.length,
  });
}

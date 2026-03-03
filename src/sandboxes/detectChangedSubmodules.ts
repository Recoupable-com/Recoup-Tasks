import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Detects which submodules in the monorepo have uncommitted changes.
 * Runs `git status --porcelain` in each submodule directory.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param monorepoDir - Path to the cloned monorepo
 * @returns Array of submodule names that have modifications
 */
export async function detectChangedSubmodules(
  sandbox: Sandbox,
  monorepoDir: string,
): Promise<string[]> {
  // List directories in the monorepo root (submodules are top-level dirs)
  const lsResult = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `ls -d ${monorepoDir}/*/ 2>/dev/null | xargs -I{} basename {} | grep -v node_modules`,
    ],
  });

  const allDirs = ((await lsResult.stdout()) || "")
    .trim()
    .split("\n")
    .filter(Boolean);

  const changed: string[] = [];

  for (const dir of allDirs) {
    const statusResult = await sandbox.runCommand({
      cmd: "git",
      args: ["-C", `${monorepoDir}/${dir}`, "status", "--porcelain"],
    });

    const stdout = (await statusResult.stdout()) || "";

    if (stdout.trim().length > 0) {
      logger.log(`Submodule ${dir} has changes`);
      changed.push(dir);
    }
  }

  if (changed.length === 0) {
    logger.log("No changed submodules detected");
  } else {
    logger.log("Changed submodules detected", { changed });
  }

  return changed;
}

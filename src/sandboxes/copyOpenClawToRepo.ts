import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Copies the OpenClaw config directory (~/.openclaw) into the sandbox
 * working directory so it gets committed to the GitHub repo.
 *
 * Removes any nested .git directories from the copy to avoid
 * conflicting with the sandbox's own git repo.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function copyOpenClawToRepo(sandbox: Sandbox): Promise<void> {
  logger.log("Copying ~/.openclaw into repo");

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "rm -rf /vercel/sandbox/.openclaw && cp -r ~/.openclaw /vercel/sandbox/.openclaw && find /vercel/sandbox/.openclaw -name .git -type d -exec rm -rf {} + 2>/dev/null || true",
    ],
  });

  logger.log("OpenClaw files copied to repo");
}

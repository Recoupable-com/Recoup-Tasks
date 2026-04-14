import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs all skills from a skills.sh repo into the OpenClaw workspace.
 *
 * Runs `npx skills add <source> -y` which installs to .agents/skills/,
 * then copies everything to ~/.openclaw/workspace/skills/ so OpenClaw
 * discovers them natively.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param source - The skills.sh source (e.g. "recoupable/skills")
 */
export async function installSkills(
  sandbox: Sandbox,
  source: string
): Promise<void> {
  logger.log("Installing skills via skills.sh", { source });

  const install = await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", source, "-y"],
  });

  const installStdout = (await install.stdout()) || "";
  const installStderr = (await install.stderr()) || "";

  logger.log("skills.sh install result", {
    exitCode: install.exitCode,
    stdout: installStdout,
    stderr: installStderr,
  });

  if (install.exitCode !== 0) {
    logger.warn("Skills install failed, continuing without them", {
      source,
      stderr: installStderr,
    });
    return;
  }

  const copy = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      "mkdir -p ~/.openclaw/workspace/skills && cp -r .agents/skills/* ~/.openclaw/workspace/skills/",
    ],
  });

  const copyStderr = (await copy.stderr()) || "";

  if (copy.exitCode !== 0) {
    logger.warn("Failed to copy skills to OpenClaw workspace, continuing without them", {
      source,
      stderr: copyStderr,
    });
    return;
  }

  logger.log("Skills installed to OpenClaw workspace", { source });
}

import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs a skills.sh skill into the OpenClaw workspace skills directory.
 *
 * skills.sh installs to .agents/skills/ — this function copies the result
 * to ~/.openclaw/workspace/skills/ so OpenClaw discovers it natively.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param skill - The skills.sh skill identifier (e.g. "recoupable/setup-sandbox")
 */
export async function installSkill(
  sandbox: Sandbox,
  skill: string
): Promise<void> {
  const skillName = skill.split("/").pop()!;

  logger.log("Installing skill via skills.sh", { skill });

  const install = await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", skill, "-y"],
  });

  const installStdout = (await install.stdout()) || "";
  const installStderr = (await install.stderr()) || "";

  logger.log("skills.sh install result", {
    exitCode: install.exitCode,
    stdout: installStdout,
    stderr: installStderr,
  });

  if (install.exitCode !== 0) {
    logger.warn("Skill install failed, continuing without it", {
      skill,
      stderr: installStderr,
    });
    return;
  }

  // Copy from skills.sh location to OpenClaw workspace skills directory
  const copy = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `mkdir -p ~/.openclaw/workspace/skills && rm -rf ~/.openclaw/workspace/skills/${skillName} && cp -r .agents/skills/${skillName} ~/.openclaw/workspace/skills/${skillName}`,
    ],
  });

  const copyStderr = (await copy.stderr()) || "";

  if (copy.exitCode !== 0) {
    logger.warn("Failed to copy skill to OpenClaw workspace, continuing without it", {
      skill,
      stderr: copyStderr,
    });
    return;
  }

  logger.log("Skill installed to OpenClaw workspace", { skillName });
}

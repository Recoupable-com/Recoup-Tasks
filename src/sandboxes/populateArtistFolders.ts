import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { ensureOpenCode } from "./ensureOpenCode";
import { installRecoupCLI } from "./installRecoupCLI";

/**
 * Populates the sandbox with org/artist folder structure by installing the
 * setup-sandbox skill and executing it via opencode.
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function populateArtistFolders(sandbox: Sandbox): Promise<void> {
  logger.log("Starting artist folder population via opencode + skill");

  await ensureOpenCode(sandbox);
  await installRecoupCLI(sandbox);

  // Install the setup-sandbox skill
  logger.log("Installing setup-sandbox skill");
  const installSkill = await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", "recoupable/skill-setup-sandbox"],
  });

  if (installSkill.exitCode !== 0) {
    const stderr = (await installSkill.stderr()) || "";
    logger.error("Failed to install setup-sandbox skill", {
      exitCode: installSkill.exitCode,
      stderr,
    });
    throw new Error("Failed to install setup-sandbox skill");
  }

  // Run opencode to execute the skill
  logger.log("Running opencode to execute setup-sandbox skill");

  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const result = await sandbox.runCommand({
    cmd: "opencode",
    args: [
      "run",
      "--format",
      "json",
      "Execute the setup-sandbox skill to create org and artist folders",
    ],
    env: {
      RECOUP_API_KEY: recoupApiKey,
    },
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  if (result.exitCode !== 0) {
    logger.error("opencode execution failed", {
      exitCode: result.exitCode,
      stdout,
      stderr,
    });
    throw new Error("opencode failed to populate artist folders");
  }

  logger.log("Artist folder population complete", {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });
}

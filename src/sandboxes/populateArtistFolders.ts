import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { ensureOpenCode } from "./ensureOpenCode";
import { installRecoupCLI } from "./installRecoupCLI";

/**
 * Populates the sandbox with org/artist folder structure by installing the
 * setup-sandbox skill and executing it via opencode.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID to fetch data for
 */
export async function populateArtistFolders(sandbox: Sandbox, accountId: string): Promise<void> {
  logger.log("Starting artist folder population via opencode + skill");

  await ensureOpenCode(sandbox);
  await installRecoupCLI(sandbox);

  // Install the setup-sandbox skill
  logger.log("Installing setup-sandbox skill");
  const installSkill = await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", "recoupable/skill-setup-sandbox", "-y", "-g"],
  });

  const skillStdout = (await installSkill.stdout()) || "";
  const skillStderr = (await installSkill.stderr()) || "";

  logger.log("Skill install result", {
    exitCode: installSkill.exitCode,
    stdout: skillStdout,
    stderr: skillStderr,
  });

  if (installSkill.exitCode !== 0) {
    throw new Error("Failed to install setup-sandbox skill");
  }

  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  // Verify which account the API key resolves to
  const whoami = await sandbox.runCommand({
    cmd: "recoup",
    args: ["whoami"],
    env: { RECOUP_API_KEY: recoupApiKey },
  });
  logger.log("Recoup whoami", {
    stdout: (await whoami.stdout()) || "",
    stderr: (await whoami.stderr()) || "",
  });

  // Run opencode to execute the skill
  logger.log("Running opencode to execute setup-sandbox skill");

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
      RECOUP_ACCOUNT_ID: accountId,
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

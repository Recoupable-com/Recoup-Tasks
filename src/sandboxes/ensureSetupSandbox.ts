import type { Sandbox } from "@vercel/sandbox";
import { logger, metadata } from "@trigger.dev/sdk/v3";
import { installSkill } from "./installSkill";
import { runSetupSandboxSkill } from "./runSetupSandboxSkill";
import { runSetupArtistSkill } from "./runSetupArtistSkill";
/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Installs skills, runs setup-sandbox, then setup-artist for each artist.
 * Idempotent — skips if `orgs/` directory already exists.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 */
export async function ensureSetupSandbox(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  const check = await sandbox.runCommand({
    cmd: "test",
    args: ["-d", "orgs/"],
  });

  if (check.exitCode === 0) {
    logger.log("Sandbox already set up, skipping");
    return;
  }

  metadata.set("currentStep", "Installing skills");
  metadata.append("logs", "Installing skills");

  await installSkill(sandbox, "recoupable/setup-sandbox");
  await installSkill(sandbox, "recoupable/setup-artist");
  await installSkill(sandbox, "recoupable/release-management");

  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const env = {
    RECOUP_API_KEY: process.env.RECOUP_API_KEY,
    RECOUP_ACCOUNT_ID: accountId,
  };

  metadata.set("currentStep", "Running setup-sandbox skill");
  metadata.append("logs", "Running setup-sandbox skill");
  await runSetupSandboxSkill(sandbox, env);
  metadata.append("logs", "Setup-sandbox complete");

  metadata.set("currentStep", "Running setup-artist skill");
  metadata.append("logs", "Running setup-artist skill");
  await runSetupArtistSkill(sandbox, env);
  metadata.append("logs", "Setup-artist complete");

  logger.log("Sandbox setup complete");
}

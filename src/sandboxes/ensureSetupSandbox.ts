import type { Sandbox } from "@vercel/sandbox";
import { logger, metadata } from "@trigger.dev/sdk/v3";
import { installSkill } from "./installSkill";
/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Uses OpenClaw with the setup-sandbox skill to create the structure.
 * Idempotent — skips if `orgs/` directory already exists.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 */
export async function ensureSetupSandbox(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  // Check if orgs/ directory already exists
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

  // Step 1: Run setup-sandbox to create org/artist folder structure
  metadata.set("currentStep", "Running setup-sandbox skill");
  metadata.append("logs", "Running setup-sandbox skill");
  logger.log("Running setup-sandbox skill");

  const sandboxSetup = await sandbox.runCommand({
    cmd: "openclaw",
    args: [
      "agent", "--agent", "main", "--message",
      "Install the Recoup CLI globally: npm install -g @recoupable/cli\n\nThen run the /setup-sandbox skill to create the org and artist folder structure.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    ],
    env,
  });

  const sandboxStdout = (await sandboxSetup.stdout()) || "";
  const sandboxStderr = (await sandboxSetup.stderr()) || "";

  logger.log("Setup-sandbox result", {
    exitCode: sandboxSetup.exitCode,
    stdout: sandboxStdout,
    stderr: sandboxStderr,
  });

  if (sandboxSetup.exitCode !== 0) {
    metadata.append("logs", `Setup-sandbox failed: ${sandboxStderr || sandboxStdout}`);
    throw new Error("Failed to set up sandbox via OpenClaw");
  }

  metadata.append("logs", "Setup-sandbox complete");

  // Step 2: Run setup-artist for each artist created in step 1
  metadata.set("currentStep", "Running setup-artist skill");
  metadata.append("logs", "Running setup-artist skill");
  logger.log("Running setup-artist skill");

  const artistSetup = await sandbox.runCommand({
    cmd: "openclaw",
    args: [
      "agent", "--agent", "main", "--message",
      "Run the /setup-artist skill for EACH artist folder that exists under orgs/.\n\nRECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.",
    ],
    env,
  });

  const artistStdout = (await artistSetup.stdout()) || "";
  const artistStderr = (await artistSetup.stderr()) || "";

  logger.log("Setup-artist result", {
    exitCode: artistSetup.exitCode,
    stdout: artistStdout,
    stderr: artistStderr,
  });

  if (artistSetup.exitCode !== 0) {
    metadata.append("logs", `Setup-artist failed: ${artistStderr || artistStdout}`);
    throw new Error("Failed to set up artists via OpenClaw");
  }

  metadata.append("logs", "Setup-artist complete");
  logger.log("Sandbox setup complete");
}

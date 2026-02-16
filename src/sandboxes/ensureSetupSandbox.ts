import type { Sandbox } from "@vercel/sandbox";
import { logger, metadata } from "@trigger.dev/sdk/v3";

/**
 * Ensures the sandbox has the org/artist folder structure set up.
 * Uses OpenCode with the setup-sandbox skill to create the structure.
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

  // Install the setup-sandbox skill for OpenCode
  metadata.set("currentStep", "Installing setup-sandbox skill");
  metadata.append("logs", "Installing setup-sandbox skill");
  logger.log("Installing setup-sandbox skill");

  await sandbox.runCommand({
    cmd: "npx",
    args: [
      "skills",
      "add",
      "recoupable/skill-setup-sandbox",
      "-a",
      "opencode",
      "-y",
    ],
  });

  // Run OpenCode with the setup-sandbox skill
  metadata.set("currentStep", "Running setup-sandbox skill via OpenCode");
  metadata.append("logs", "Running setup-sandbox skill via OpenCode");
  logger.log("Running setup-sandbox skill via OpenCode");

  const setupPrompt = `First, install the Recoup CLI globally: npm install -g @recoupable/cli

Then run the /setup-sandbox skill to create the org and artist folder structure.

RECOUP_API_KEY and RECOUP_ACCOUNT_ID are set in the environment.`;

  const result = await sandbox.runCommand({
    cmd: "opencode",
    args: ["-p", setupPrompt],
    env: {
      RECOUP_API_KEY: process.env.RECOUP_API_KEY!,
      RECOUP_ACCOUNT_ID: accountId,
    },
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("Setup-sandbox skill result", {
    exitCode: result.exitCode,
    stdoutLength: stdout.length,
    stderrLength: stderr.length,
  });

  if (result.exitCode !== 0) {
    logger.error("Setup-sandbox skill failed", { stdout, stderr });
    throw new Error("Failed to set up sandbox via OpenCode");
  }

  metadata.append("logs", "Setup-sandbox skill completed");
  logger.log("Sandbox setup complete");
}

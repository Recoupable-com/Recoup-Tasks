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

  // Run OpenClaw with setup-sandbox then setup-artist for each artist
  metadata.set("currentStep", "Running setup skills via OpenClaw");
  metadata.append("logs", "Running setup skills via OpenClaw");
  logger.log("Running setup skills via OpenClaw");

  const setupPrompt = `First, install the Recoup CLI globally: npm install -g @recoupable/cli

Then follow these steps in order:

1. Run the /setup-sandbox skill to create the org and artist folder structure.
2. After the folder structure is created, run the /setup-artist skill for EACH artist that was created in step 1.

RECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as environment variables.`;

  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", setupPrompt],
    env: {
      RECOUP_API_KEY: process.env.RECOUP_API_KEY,
      RECOUP_ACCOUNT_ID: accountId,
    },
  });

  const stdout = (await result.stdout()) || "";
  const stderr = (await result.stderr()) || "";

  logger.log("Setup-sandbox skill result", {
    exitCode: result.exitCode,
    stdout,
    stderr,
  });

  if (result.exitCode !== 0) {
    metadata.append("logs", `Setup-sandbox failed: ${stderr || stdout}`);
    throw new Error("Failed to set up sandbox via OpenClaw");
  }

  metadata.append("logs", `Setup-sandbox output: ${stdout || stderr}`);
  logger.log("Sandbox setup complete");
}

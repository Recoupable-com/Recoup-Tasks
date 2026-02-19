import type { Sandbox } from "@vercel/sandbox";
import { logger, metadata } from "@trigger.dev/sdk/v3";

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

  // Install the setup-sandbox skill for OpenClaw
  metadata.set("currentStep", "Installing setup-sandbox skill");
  metadata.append("logs", "Installing setup-sandbox skill");
  logger.log("Installing setup-sandbox skill");

  await sandbox.runCommand({
    cmd: "npx",
    args: [
      "skills",
      "add",
      "recoupable/setup-sandbox",
      "-y",
    ],
  });

  // Run OpenClaw with the setup-sandbox skill
  metadata.set("currentStep", "Running setup-sandbox skill via OpenClaw");
  metadata.append("logs", "Running setup-sandbox skill via OpenClaw");
  logger.log("Running setup-sandbox skill via OpenClaw");

  const setupPrompt = `First, install the Recoup CLI globally: npm install -g @recoupable/cli

Then run the /setup-sandbox skill to create the org and artist folder structure.

RECOUP_API_KEY and RECOUP_ACCOUNT_ID are set in the environment.`;

  // Write env vars to ~/.openclaw/.env so OpenClaw picks them up
  // (OpenClaw loads ~/.openclaw/.env as a global dotenv source)
  logger.log("Setting sandbox env vars", {
    RECOUP_API_KEY: process.env.RECOUP_API_KEY ? `${process.env.RECOUP_API_KEY.slice(0, 8)}...` : "MISSING",
    RECOUP_ACCOUNT_ID: accountId || "MISSING",
  });

  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `echo 'RECOUP_API_KEY=${process.env.RECOUP_API_KEY}' >> ~/.openclaw/.env && echo 'RECOUP_ACCOUNT_ID=${accountId}' >> ~/.openclaw/.env`,
    ],
  });

  const result = await sandbox.runCommand({
    cmd: "openclaw",
    args: ["agent", "--agent", "main", "--message", setupPrompt],
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

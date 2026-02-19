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

RECOUP_API_KEY and RECOUP_ACCOUNT_ID are available as inherited process environment variables.`;

  // Inline env vars so they're in the process tree and inherited by
  // all child processes OpenClaw spawns (skills, CLI tools, etc.)
  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const apiKey = process.env.RECOUP_API_KEY;

  logger.log("Setting sandbox env vars", {
    RECOUP_API_KEY: `${apiKey.slice(0, 4)}...`,
    RECOUP_ACCOUNT_ID: accountId || "MISSING",
  });

  // Write env vars to /etc/environment so they persist across all
  // processes and subshells OpenClaw spawns (exec tool, etc.)
  await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `printf 'RECOUP_API_KEY=%s\\nRECOUP_ACCOUNT_ID=%s\\n' '${apiKey}' '${accountId}' >> /etc/environment`,
    ],
  });

  const escapedPrompt = setupPrompt.replace(/'/g, "'\\''");

  const result = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `RECOUP_API_KEY='${apiKey}' RECOUP_ACCOUNT_ID='${accountId}' openclaw agent --agent main --message '${escapedPrompt}'`,
    ],
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

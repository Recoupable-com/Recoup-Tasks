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

  // skills.sh installs to .agents/skills/ — copy to workspace/skills/ for OpenClaw discovery
  // OpenClaw workspace defaults to ~/.openclaw/workspace/
  await sandbox.runCommand({
    cmd: "npx",
    args: ["skills", "add", "recoupable/setup-sandbox", "-y"],
  });

  const copySkill = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "mkdir -p ~/.openclaw/workspace/skills && rm -rf ~/.openclaw/workspace/skills/setup-sandbox && cp -r .agents/skills/setup-sandbox ~/.openclaw/workspace/skills/setup-sandbox"],
  });

  if (copySkill.exitCode !== 0) {
    const stderr = (await copySkill.stderr()) || "";
    logger.error("Failed to copy skill to OpenClaw workspace skills directory", { stderr });
    throw new Error("Failed to copy setup-sandbox skill to workspace/skills/");
  }

  logger.log("Skill installed to ~/.openclaw/workspace/skills/setup-sandbox");

  // Run OpenClaw with the setup-sandbox skill
  metadata.set("currentStep", "Running setup-sandbox skill via OpenClaw");
  metadata.append("logs", "Running setup-sandbox skill via OpenClaw");
  logger.log("Running setup-sandbox skill via OpenClaw");

  const setupPrompt = `First, install the Recoup CLI globally: npm install -g @recoupable/cli

Then run the /setup-sandbox skill to create the org and artist folder structure.

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

import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs OpenClaw CLI globally in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if installation fails
 */
export async function installOpenClaw(sandbox: Sandbox): Promise<void> {
  logger.log("Installing OpenClaw CLI globally");

  const installCLI = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "openclaw"],
    sudo: true,
  });

  if (installCLI.exitCode !== 0) {
    const stdout = (await installCLI.stdout()) || "";
    const stderr = (await installCLI.stderr()) || "";
    logger.error("Failed to install OpenClaw CLI", {
      exitCode: installCLI.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to install OpenClaw CLI");
  }

  logger.log("OpenClaw installation complete");
}

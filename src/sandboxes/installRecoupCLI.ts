import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs the Recoup CLI globally in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if installation fails
 */
export async function installRecoupCLI(sandbox: Sandbox): Promise<void> {
  logger.log("Installing Recoup CLI globally");

  const result = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "@recoupable/cli@latest"],
    sudo: true,
  });

  if (result.exitCode !== 0) {
    const stderr = (await result.stderr()) || "";
    logger.error("Failed to install Recoup CLI", {
      exitCode: result.exitCode,
      stderr,
    });
    throw new Error("Failed to install Recoup CLI");
  }

  logger.log("Recoup CLI installation complete");
}

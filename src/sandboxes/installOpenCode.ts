import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs OpenCode CLI globally in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if installation fails
 */
export async function installOpenCode(sandbox: Sandbox): Promise<void> {
  logger.log("Installing OpenCode CLI globally");

  const installCLI = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "opencode-ai@latest"],
    sudo: true,
  });

  if (installCLI.exitCode !== 0) {
    const stdout = (await installCLI.stdout()) || "";
    const stderr = (await installCLI.stderr()) || "";
    logger.error("Failed to install OpenCode CLI", {
      exitCode: installCLI.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to install OpenCode CLI");
  }

  logger.log("OpenCode installation complete");
}

import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Installs Claude Code CLI and Anthropic SDK in the sandbox.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if installation fails
 */
export async function installClaudeCode(sandbox: Sandbox): Promise<void> {
  logger.log("Installing Claude Code CLI globally");

  const installCLI = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "-g", "@anthropic-ai/claude-code"],
    sudo: true,
  });

  if (installCLI.exitCode !== 0) {
    const stdout = (await installCLI.stdout()) || "";
    const stderr = (await installCLI.stderr()) || "";
    logger.error("Failed to install Claude Code CLI", {
      exitCode: installCLI.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to install Claude Code CLI");
  }

  logger.log("Installing Anthropic SDK");

  const installSDK = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "@anthropic-ai/sdk"],
  });

  if (installSDK.exitCode !== 0) {
    const stdout = (await installSDK.stdout()) || "";
    const stderr = (await installSDK.stderr()) || "";
    logger.error("Failed to install Anthropic SDK", {
      exitCode: installSDK.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to install Anthropic SDK");
  }

  logger.log("Claude Code installation complete");
}

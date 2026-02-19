import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Onboards OpenClaw with AI Gateway credentials and starts the gateway
 * process in the background.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @throws Error if onboarding or gateway startup fails
 */
export async function setupOpenClaw(sandbox: Sandbox): Promise<void> {
  logger.log("Running OpenClaw onboard");

  const onboard = await sandbox.runCommand({
    cmd: "openclaw",
    args: [
      "onboard",
      "--non-interactive",
      "--mode",
      "local",
      "--auth-choice",
      "ai-gateway-api-key",
      "--ai-gateway-api-key",
      process.env.AI_GATEWAY_API_KEY!,
      "--gateway-port",
      "18789",
      "--gateway-bind",
      "loopback",
      "--accept-risk",
    ],
  });

  if (onboard.exitCode !== 0) {
    const stdout = (await onboard.stdout()) || "";
    const stderr = (await onboard.stderr()) || "";
    logger.error("Failed to onboard OpenClaw", {
      exitCode: onboard.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to onboard OpenClaw");
  }

  logger.log("OpenClaw onboard complete, starting gateway");

  const gateway = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "nohup openclaw gateway run > /tmp/gateway.log 2>&1 &"],
  });

  if (gateway.exitCode !== 0) {
    const stdout = (await gateway.stdout()) || "";
    const stderr = (await gateway.stderr()) || "";
    logger.error("Failed to start OpenClaw gateway", {
      exitCode: gateway.exitCode,
      stdout,
      stderr,
    });
    throw new Error("Failed to start OpenClaw gateway");
  }

  logger.log("OpenClaw gateway started");
}

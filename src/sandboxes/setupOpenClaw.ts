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
  const onboardArgs = [
    "onboard",
    "--non-interactive",
    "--mode",
    "local",
    "--auth-choice",
    "ai-gateway-api-key",
    "--ai-gateway-api-key",
    process.env.VERCEL_AI_GATEWAY_API_KEY!,
    "--gateway-port",
    "18789",
    "--gateway-bind",
    "loopback",
    "--accept-risk",
  ];

  logger.log("Running OpenClaw onboard", {
    command: `openclaw ${onboardArgs.map((a) => (a === process.env.VERCEL_AI_GATEWAY_API_KEY ? "[REDACTED]" : a)).join(" ")}`,
  });

  const onboard = await sandbox.runCommand({
    cmd: "openclaw",
    args: onboardArgs,
  });

  const onboardStdout = (await onboard.stdout()) || "";
  const onboardStderr = (await onboard.stderr()) || "";

  if (onboard.exitCode !== 0) {
    // Onboard writes config successfully but exits non-zero when it can't
    // verify the gateway connection (gateway isn't running yet). As long as
    // the config was written we can proceed to start the gateway ourselves.
    logger.warn("OpenClaw onboard exited with non-zero code", {
      exitCode: onboard.exitCode,
      stdout: onboardStdout,
      stderr: onboardStderr,
    });
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

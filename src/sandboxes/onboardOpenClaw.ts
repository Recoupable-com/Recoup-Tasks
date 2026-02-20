import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Runs OpenClaw onboard in the sandbox if not already configured.
 * Skips if ~/.openclaw/openclaw.json already exists (e.g. snapshot restore).
 *
 * @param sandbox - The Vercel Sandbox instance
 */
export async function onboardOpenClaw(sandbox: Sandbox): Promise<void> {
  const configCheck = await sandbox.runCommand({
    cmd: "sh",
    args: ["-c", "test -f ~/.openclaw/openclaw.json"],
  });

  if (configCheck.exitCode === 0) {
    logger.log("OpenClaw already onboarded, skipping");
    return;
  }

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
}

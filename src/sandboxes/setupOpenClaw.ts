import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Onboards OpenClaw with AI Gateway credentials, seeds env vars into
 * the config, and starts the gateway process in the background.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 * @throws Error if onboarding or gateway startup fails
 */
export async function setupOpenClaw(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
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

  // Inject RECOUP env vars into openclaw.json's env block so they're
  // available to the agent and all tools/subprocesses it spawns.
  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  logger.log("Injecting env vars into openclaw.json", {
    RECOUP_API_KEY: `${process.env.RECOUP_API_KEY.slice(0, 4)}...`,
    RECOUP_ACCOUNT_ID: accountId,
  });

  const injectEnv = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-c",
      `node -e "
        const fs = require('fs');
        const p = require('os').homedir() + '/.openclaw/openclaw.json';
        const c = JSON.parse(fs.readFileSync(p, 'utf8'));
        c.env = c.env || {};
        c.env.RECOUP_API_KEY = '${process.env.RECOUP_API_KEY}';
        c.env.RECOUP_ACCOUNT_ID = '${accountId}';
        fs.writeFileSync(p, JSON.stringify(c, null, 2));
      "`,
    ],
  });

  if (injectEnv.exitCode !== 0) {
    const stderr = (await injectEnv.stderr()) || "";
    logger.error("Failed to inject env vars into openclaw.json", {
      exitCode: injectEnv.exitCode,
      stderr,
    });
    throw new Error("Failed to inject env vars into openclaw.json");
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

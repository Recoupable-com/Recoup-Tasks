import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { onboardOpenClaw } from "./onboardOpenClaw";
import { CODING_AGENT_MODEL } from "../consts";

/**
 * Ensures OpenClaw is onboarded, seeds env vars into the config,
 * and starts the gateway process in the background.
 *
 * @param sandbox - The Vercel Sandbox instance
 * @param accountId - The account ID for the sandbox owner
 * @throws Error if env injection or gateway startup fails
 */
export async function setupOpenClaw(
  sandbox: Sandbox,
  accountId: string
): Promise<void> {
  await onboardOpenClaw(sandbox);

  // Inject RECOUP env vars into openclaw.json's env block so they're
  // available to the agent and all tools/subprocesses it spawns.
  if (!process.env.RECOUP_API_KEY) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const githubToken = process.env.GITHUB_TOKEN;

  logger.log("Injecting env vars into openclaw.json", {
    RECOUP_API_KEY: `${process.env.RECOUP_API_KEY.slice(0, 4)}...`,
    RECOUP_ACCOUNT_ID: accountId,
    GITHUB_TOKEN: githubToken ? "present" : "missing",
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
        ${githubToken ? `c.env.GITHUB_TOKEN = '${githubToken}';` : ""}
        c.tools = c.tools || {};
        c.tools.profile = 'coding';
        c.model = 'vercel-ai-gateway/${CODING_AGENT_MODEL}';
        c.defaultModel = 'vercel-ai-gateway/${CODING_AGENT_MODEL}';
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

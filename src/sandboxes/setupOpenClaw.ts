import type { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { onboardOpenClaw } from "./onboardOpenClaw";
import { OPENCLAW_DEFAULT_MODEL } from "../consts";

// Constant script body. No interpolation of caller-supplied values — all
// secrets are read at runtime from process.env inside the sandbox, so a
// value containing quotes, backslashes, or newlines cannot break out of
// the shell or the JS string. See: shell-injection fix for accountId.
const INJECT_ENV_SCRIPT = `
  const fs = require('fs');
  const os = require('os');
  const path = os.homedir() + '/.openclaw/openclaw.json';
  const c = JSON.parse(fs.readFileSync(path, 'utf8'));
  c.env = c.env || {};
  c.env.RECOUP_API_KEY = process.env.RECOUP_API_KEY;
  c.env.RECOUP_ACCOUNT_ID = process.env.RECOUP_ACCOUNT_ID;
  if (process.env.GITHUB_TOKEN) {
    c.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  }
  c.tools = c.tools || {};
  c.tools.profile = 'coding';
  c.agents = c.agents || {};
  c.agents.defaults = c.agents.defaults || {};
  c.agents.defaults.model = c.agents.defaults.model || {};
  c.agents.defaults.model.primary = process.env.OPENCLAW_DEFAULT_MODEL;
  fs.writeFileSync(path, JSON.stringify(c, null, 2));
`;

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

  const recoupApiKey = process.env.RECOUP_API_KEY;
  if (!recoupApiKey) {
    throw new Error("Missing RECOUP_API_KEY environment variable");
  }

  const githubToken = process.env.GITHUB_TOKEN;

  logger.log("Injecting env vars into openclaw.json", {
    RECOUP_API_KEY: `${recoupApiKey.slice(0, 4)}...`,
    RECOUP_ACCOUNT_ID: accountId,
    GITHUB_TOKEN: githubToken ? "present" : "missing",
  });

  const injectEnvOpts: Record<string, unknown> = {
    cmd: "node",
    args: ["-e", INJECT_ENV_SCRIPT],
    env: {
      RECOUP_API_KEY: recoupApiKey,
      RECOUP_ACCOUNT_ID: accountId,
      OPENCLAW_DEFAULT_MODEL,
      ...(githubToken ? { GITHUB_TOKEN: githubToken } : {}),
    },
  };

  const injectEnv = await sandbox.runCommand(injectEnvOpts as any);

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
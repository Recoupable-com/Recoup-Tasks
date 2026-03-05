import { Sandbox } from "@vercel/sandbox";
import { logger } from "@trigger.dev/sdk/v3";
import { getAccountSandboxes } from "../recoup/getAccountSandboxes";
import { createAccountSandbox } from "../recoup/createAccountSandbox";
import { getVercelSandboxCredentials } from "./getVercelSandboxCredentials";
import { logStep } from "./logStep";

interface GetOrCreateSandboxResult {
  sandboxId: string;
  sandbox: Sandbox;
}

/**
 * Gets or creates a sandbox for an account, preferring to restore from
 * an existing snapshot for faster startup.
 *
 * Falls back to creating a fresh sandbox via the API if no snapshot exists
 * or if snapshot restoration fails.
 *
 * @param accountId - The account ID to get or create a sandbox for
 * @returns The sandbox ID and connected Sandbox instance
 */
export async function getOrCreateSandbox(
  accountId: string,
): Promise<GetOrCreateSandboxResult> {
  const { token, teamId, projectId } = getVercelSandboxCredentials();

  // Try to restore from existing snapshot
  const sandboxesInfo = await getAccountSandboxes(accountId);

  if (sandboxesInfo?.snapshotId) {
    try {
      logStep("Restoring sandbox from snapshot", true, {
        snapshotId: sandboxesInfo.snapshotId,
      });

      const sandbox = await Sandbox.create({
        source: { type: "snapshot", snapshotId: sandboxesInfo.snapshotId },
        token,
        teamId,
        projectId,
      });

      logStep("Sandbox restored from snapshot", true, {
        sandboxId: sandbox.sandboxId,
      });

      return { sandboxId: sandbox.sandboxId, sandbox };
    } catch (error) {
      logger.error("Failed to restore from snapshot, falling back to fresh sandbox", {
        snapshotId: sandboxesInfo.snapshotId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fall back to creating a fresh sandbox
  logStep("Creating fresh sandbox");

  const created = await createAccountSandbox(accountId);
  if (!created) {
    throw new Error(`Failed to create sandbox for account ${accountId}`);
  }

  const sandbox = await Sandbox.get({
    sandboxId: created.sandboxId,
    token,
    teamId,
    projectId,
  });

  logStep("Fresh sandbox created", true, { sandboxId: created.sandboxId });

  return { sandboxId: created.sandboxId, sandbox };
}
